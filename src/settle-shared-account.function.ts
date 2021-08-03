import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {ErrorMessage} from './models/error-message';
import {House, SharedAccount} from './models';
const db = admin.firestore();

interface AccountsPayout {
    [accountId: string]: Payout;
}

interface Payout {
    totalOut: number;
    products: {
        [productId: string]: {
            totalOut: number,
            amountOut: number,
        };
    };
}

interface SettleSharedAccountData {
    houseId: string;
    sharedAccountId: string;
    settlement: AccountsPayout;
}

/**
 * settleSharedAccount
 *
 * HTTP Trigger function for editing an existing transaction and use atomic operations for updating the balances of accounts and updating
 * product data.
 *
 * @var houseId: string
 * @var updatedTransaction: Transaction Object
 * @var deltaTransaction: Transaction Object
 *
 * @returns void
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws USER_ACCOUNT_NOT_FOUND if the account of the user was not found in this house
 */
export const settleSharedAccount = functions.region('europe-west1').https
    .onCall((data: SettleSharedAccountData, context) => {

        const userId: string | undefined = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
        }

        if (!data.houseId || !data.sharedAccountId || !data.settlement) {
            throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
        }

        const houseRef = db.collection('houses').doc(data.houseId);
        return db.runTransaction(fireTrans => {
            return fireTrans.get(houseRef)
                .then(houseDoc => {
                    const house: House = houseDoc?.data() as House;

                    // Check if the house exists
                    if (!houseDoc.exists || !house) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.HOUSE_NOT_FOUND);
                    }

                    // Check if the user is part of this house
                    if (!house.members.includes(userId)) {
                        throw new functions.https.HttpsError('permission-denied', ErrorMessage.NOT_MEMBER_OF_HOUSE);
                    }

                    // Check if the shared account is part of this house
                    if (!house.sharedAccounts.find((acc: SharedAccount) => acc.id === data.sharedAccountId)) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.SHARED_ACCOUNT_NOT_FOUND);
                    }

                    // Create an update object
                    const updateObject: {
                        [key: string]: unknown,
                    } = {
                        [`balances.${data.sharedAccountId}.totalIn`]: 0,
                        [`balances.${data.sharedAccountId}.totalOut`]: 0,
                        [`balances.${data.sharedAccountId}.products`]: {},
                        sharedAccounts: house.sharedAccounts.map((acc: SharedAccount) => {
                            if (acc.id === data.sharedAccountId) {
                                acc.settledAt = admin.firestore.Timestamp.now();
                            }

                            return acc;
                        }),
                    };

                    Object.keys(data.settlement).forEach((accountId: string) => {
                        const payer: Payout = data.settlement[accountId];

                        updateObject[`balances.${accountId}.totalOut`] = admin.firestore.FieldValue.increment(payer.totalOut);

                        Object.keys(payer.products)
                            .forEach((productId: string) => {
                                updateObject[`balances.${accountId}.products.${productId}.totalOut`]
                                    = admin.firestore.FieldValue.increment(payer.products[productId].totalOut);
                                updateObject[`balances.${accountId}.products.${productId}.amountOut`]
                                    = admin.firestore.FieldValue.increment(payer.products[productId].amountOut);
                            });
                    });

                    // Update the house
                    fireTrans.update(houseRef, updateObject);
                })
                .catch(err => {
                    console.error(err);
                    throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
                });
        });
    });
