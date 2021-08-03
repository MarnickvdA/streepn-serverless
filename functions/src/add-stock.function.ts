import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {House, Product, Stock} from './models';
import {ErrorMessage} from './models/error-message';
import {getHouseUpdateDataIn} from './helpers/stock.helper';

const {v4: uuidv4} = require('uuid');
const db = admin.firestore();

interface AddStockData {
    houseId: string;
    stock: Stock;
}

/**
 * addStock
 *
 * HTTP Trigger function for adding a stock item to a house
 *
 * @var houseId: string
 * @var stock: Stock Object
 *
 * @returns added Stock
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws PRODUCT_NOT_FOUND if the product provided in the stock object was not found in this house
 */
export const addStock = functions.region('europe-west1').https.onCall((data: AddStockData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
    }

    if (!data.houseId || !data.stock) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    const houseRef = db.collection('houses').doc(data.houseId);

    return db.runTransaction(fireTrans => {
        return fireTrans.get(houseRef)
            .then(houseDoc => {
                const house: House = houseDoc.data() as House;

                // Check if the house exists
                if (!houseDoc.exists || !house) {
                    throw new functions.https.HttpsError('not-found', ErrorMessage.HOUSE_NOT_FOUND);
                }

                // Check if the user is part of this house
                if (!house.members.includes(userId)) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.NOT_MEMBER_OF_HOUSE);
                }

                const currentProduct: Product | undefined = house.products.find((product: Product) => product.id === data.stock.productId);

                if (!currentProduct) {
                    throw new functions.https.HttpsError('not-found', ErrorMessage.PRODUCT_NOT_FOUND);
                }

                const uid: string = uuidv4();
                const newStock: Stock = {
                    id: uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: data.stock.createdBy,
                    paidById: data.stock.paidById,
                    productId: data.stock.productId,
                    cost: data.stock.cost,
                    amount: data.stock.amount,
                };

                // Add the transaction to firestore
                fireTrans.set(houseRef.collection('stock').doc(uid), newStock);

                fireTrans.update(houseRef, getHouseUpdateDataIn(data.stock));

                return newStock;
            })
            .catch(err => {
                console.error(err);
                throw new functions.https.HttpsError('unknown', ErrorMessage.INTERNAL);
            });
    });
});
