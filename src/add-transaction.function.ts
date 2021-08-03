import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {ErrorMessage} from './models/error-message';
import {House, Transaction, UserAccount} from './models';
import {getTransactionUpdateObject} from './helpers/transaction.helper';
import {sendTransactionAdded} from './helpers/message.helper';

const {v4: uuidv4} = require('uuid');
const db = admin.firestore();

interface AddTransactionData {
    houseId: string;
    transaction: Transaction;
}

/**
 * addTransaction
 *
 * HTTP Trigger function for adding a new transaction and use atomic operations for increasing the balances of accounts and reducing
 * product data.
 *
 * @var houseId: string
 * @var transaction: Transaction Object
 *
 * @returns void
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws USER_ACCOUNT_NOT_FOUND if the account of the user was not found in this house
 */
export const addTransaction = functions.region('europe-west1').https
    .onCall((data: AddTransactionData, context) => {

        const userId: string | undefined = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
        }

        if (!data.houseId || !data.transaction) {
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

                    const currentAccount: UserAccount | undefined
                        = house.accounts.find((account: any) => account.userId === context.auth?.uid);

                    if (!currentAccount) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
                    }

                    const newTransaction = {
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdBy: currentAccount.id,
                        items: data.transaction.items,
                        removed: false,
                    };

                    // Add the transaction to firestore
                    fireTrans.set(houseRef.collection('transactions').doc(uuidv4()), newTransaction);

                    // Update the balance of the accounts
                    fireTrans.update(houseRef, getTransactionUpdateObject(house, data.transaction));

                    sendTransactionAdded(house, data.transaction);
                })
                .catch(err => {
                    console.error(err);
                    throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
                });
        });
    });

