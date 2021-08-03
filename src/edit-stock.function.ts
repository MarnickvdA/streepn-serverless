import {House, Stock} from './models';
import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import {getDeltaStock, getHouseUpdateDataIn} from './helpers/stock.helper';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface EditStockData {
    houseId: string;
    updatedStock: Stock;
}

/**
 * editStock
 *
 * HTTP Trigger function for editing an existing Stock object
 *
 * @var houseId: string
 * @var updatedStock: Updated state of the existing Stock Object
 * @var deltaStock: Difference between the old Stock and the new Stock object
 *
 * @returns edited Stock
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws PRODUCT_NOT_FOUND if the product provided in the stock object was not found in this house
 */
export const editStock = functions.region('europe-west1').https.onCall((data: EditStockData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
    }

    if (!data.houseId || !data.updatedStock) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    const houseRef = db.collection('houses').doc(data.houseId);

    return db.runTransaction(fireTrans => {
        return fireTrans.get(houseRef)
            .then(houseDoc => {
                const house: House = houseDoc?.data() as House;

                // Check if the house exists
                if (!houseDoc.exists || !house) {
                    throw new functions.https.HttpsError('not-found', 'No such house document!');
                }

                // Check if the user is part of this house
                if (!house.members.includes(userId)) {
                    throw new functions.https.HttpsError('permission-denied', 'User not member of house');
                }

                return fireTrans.get(houseRef.collection('stock').doc(data.updatedStock.id))
                    .then(originalDoc => {
                        const original: Stock = originalDoc?.data() as Stock;

                        // Check if the house exists
                        if (!originalDoc.exists || !original) {
                            throw new functions.https.HttpsError('not-found', 'No such stock document!');
                        }

                        const deltaStock: Stock = getDeltaStock(original, data.updatedStock);

                        // Update old stock and update stock in firestore
                        if (data.updatedStock.amount === 0) {
                            fireTrans.update(houseRef.collection('stock').doc(data.updatedStock.id), {
                                removed: true,
                            });
                        } else {
                            fireTrans.update(houseRef.collection('stock').doc(data.updatedStock.id), {
                                paidById: data.updatedStock.paidById,
                                cost: data.updatedStock.cost,
                                amount: data.updatedStock.amount,
                                productId: data.updatedStock.productId,
                            });
                        }

                        const houseUpdate: any = getHouseUpdateDataIn(deltaStock);

                        if (data.updatedStock.productId?.length > 0 && data.updatedStock.productId !== deltaStock.productId) {
                            houseUpdate[`productData.${data.updatedStock.productId}.totalIn`]
                                = admin.firestore.FieldValue.increment(data.updatedStock.cost);
                            houseUpdate[`productData.${data.updatedStock.productId}.amountIn`]
                                = admin.firestore.FieldValue.increment(data.updatedStock.amount);
                            houseUpdate[`balances.${data.updatedStock.paidById}.totalIn`]
                                = admin.firestore.FieldValue.increment(data.updatedStock.cost);
                            houseUpdate[`balances.${data.updatedStock.paidById}.products.${data.updatedStock.productId}.totalIn`]
                                = admin.firestore.FieldValue.increment(data.updatedStock.cost);
                            houseUpdate[`balances.${data.updatedStock.paidById}.products.${data.updatedStock.productId}.amountIn`]
                                = admin.firestore.FieldValue.increment(data.updatedStock.amount);
                        }

                        fireTrans.update(houseRef, houseUpdate);

                        return data.updatedStock;
                    });
            })
            .catch(err => {
                console.error(err);
                throw new functions.https.HttpsError('unknown', ErrorMessage.INTERNAL);
            });
    });
});
