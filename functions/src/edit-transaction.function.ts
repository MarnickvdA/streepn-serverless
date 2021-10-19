import {House, SharedAccount, Transaction, UserAccount} from './models';
import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import {getTransactionUpdateObject} from './helpers/transaction.helper';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface EditTransactionData {
    houseId: string;
    updatedTransaction: Transaction;
}

/**
 * editTransaction
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
export const editTransaction = functions.region('europe-west1').https
    .onCall((data: EditTransactionData, context) => {

        const userId: string | undefined = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
        }

        if (!data.houseId || !data.updatedTransaction) {
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

                    return fireTrans.get(houseRef.collection('transactions').doc(data.updatedTransaction.id))
                        .then(transactionDoc => {
                            const trans: Transaction = transactionDoc?.data() as Transaction;

                            // Check if the house exists
                            if (!transactionDoc.exists || !trans) {
                                throw new functions.https.HttpsError('not-found', ErrorMessage.TRANSACTION_NOT_FOUND);
                            }

                            const deltaTransaction: Transaction = JSON.parse(JSON.stringify(data.updatedTransaction)) as Transaction;

                            // Check if any account was already settled
                            let accountWasAlreadySettled = false;
                            deltaTransaction.items.forEach((item, index) => {
                                let account: UserAccount | SharedAccount | undefined = house.accounts.find(i => i.id === item.accountId);
                                if (!account) {
                                    account = house.sharedAccounts.find(i => i.id === item.accountId);
                                }

                                if (account && account.settledAt > trans.createdAt) {
                                    accountWasAlreadySettled = true;
                                }

                                item.amount -= trans.items[index].amount;
                            });

                            if (accountWasAlreadySettled) {
                                throw new functions.https.HttpsError('failed-precondition', ErrorMessage.ACCOUNT_ALREADY_SETTLED)
                            }

                            data.updatedTransaction.items = data.updatedTransaction.items.filter((item) => {
                                return item.amount > 0;
                            });

                            // Update old transaction and add new transaction to firestore
                            if (data.updatedTransaction.items.length === 0) {
                                fireTrans.update(houseRef.collection('transactions').doc(data.updatedTransaction.id), {
                                    removed: true,
                                });
                            } else {
                                fireTrans.update(houseRef.collection('transactions').doc(data.updatedTransaction.id), {
                                    items: data.updatedTransaction.items,
                                });
                            }

                            const updateBatch: any = getTransactionUpdateObject(house, deltaTransaction);

                            // Update the balance of the accounts
                            fireTrans.update(houseRef, updateBatch);
                        });
                })
                .catch(err => {
                    console.error(err);
                    throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
                });
        });
    });
