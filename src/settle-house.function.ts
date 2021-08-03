import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import * as admin from 'firebase-admin';
import {House, Settlement} from './models';
import {AccountBalanceMap, calculateNewBalance, calculateSettlement, deriveUpdateBatch} from './helpers/settlement.helper';

const {v4: uuidv4} = require('uuid');
const db = admin.firestore();

export interface SettleHouseData {
    houseId: string;
}

/**
 * settleHouse
 *
 * HTTP Trigger function for settling a house
 *
 * @var houseId: string
 *
 * @returns void
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws USER_ACCOUNT_NOT_FOUND if the account of the user was not found in this house
 * @throws SHARED_ACCOUNT_NOT_FOUND if the shared account with accountId was not found in this house
 * @throws PRODUCT_NOT_FOUND if the product with productId was not found in this house
 */
export const settleHouse = functions.region('europe-west1').https
    .onCall((data: SettleHouseData, context) => {

        const userId: string | undefined = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
        }

        if (!data.houseId) {
            throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
        }

        const houseRef = db.collection('houses').doc(data.houseId);

        houseRef.set({
                isSettling: true,
                settleTimeout: admin.firestore.Timestamp.now(),
            }, {merge: true})
            .catch(err => {
                console.error(err);
            });

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

                    const newAccountBalances: AccountBalanceMap = calculateNewBalance(house);

                    const updateBatch: any = deriveUpdateBatch(house, newAccountBalances);
                    const settlement: Settlement = calculateSettlement(house, userId, newAccountBalances);

                    fireTrans.update(houseRef, updateBatch);
                    fireTrans.create(houseRef.collection('settlements').doc(uuidv4()), settlement);
                })
                .catch((err: any) => {
                    houseRef.set({
                            isSettling: true,
                            settleTimeout: admin.firestore.Timestamp.now(),
                        }, {merge: true})
                        .catch(error => {
                            console.error(error);
                        });

                    console.error(err);
                    throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
                });
        });
    });
