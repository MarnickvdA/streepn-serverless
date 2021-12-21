import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import {Account, Balance, House, UserAccount, UserAccountSettlement} from './models';

const {FieldValue, getFirestore, Timestamp} = require("firebase-admin/firestore");
const db = getFirestore();
const {v4: uuidv4} = require('uuid');

interface SettleUserAccountData {
    houseId: string;
    settlerAccountId: string;
    receiverAccountId: string;
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
export const settleUserAccount = functions
    .runWith({memory: "512MB"})
    .region('europe-west1')
    .https
    .onCall((data: SettleUserAccountData, context) => {
        const userId: string | undefined = context.auth?.uid;
        if (!userId) {
            throw new functions.https.HttpsError('unauthenticated', ErrorMessage.UNAUTHENTICATED);
        }

        if (!data.houseId || !data.settlerAccountId || !data.receiverAccountId) {
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

                    const accounts = house.accounts.filter((account: any) =>
                        account.id === data.settlerAccountId
                        || account.id === data.receiverAccountId
                        || account.userId === userId);

                    if (!accounts) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
                    }

                    const issuerAccount: UserAccount | undefined = accounts.find(acc => acc.userId === userId);
                    const settlerAccount: UserAccount | undefined = accounts.find(acc => acc.id === data.settlerAccountId);
                    const receiverAccount: UserAccount | undefined = accounts.find(acc => acc.id === data.receiverAccountId);

                    // Check if the user account exists
                    if (!issuerAccount || !settlerAccount || !receiverAccount) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
                    }

                    const oldAccountSettledAt: any | undefined = settlerAccount.settledAt ? JSON.parse(JSON.stringify(settlerAccount.settledAt)) : undefined; // TODO Check if Timestamp is still correctly parsed
                    const oldAccountBalance: Balance = JSON.parse(JSON.stringify(house.balances[data.settlerAccountId]));

                    // Create an update object
                    const updateObject: {
                        [key: string]: unknown,
                    } = {
                        [`balances.${data.settlerAccountId}.totalIn`]: 0,
                        [`balances.${data.settlerAccountId}.totalOut`]: 0,
                        [`balances.${data.settlerAccountId}.products`]: {},
                        accounts: house.accounts.map((acc: UserAccount) => {
                            if (acc.id === data.settlerAccountId) {
                                acc.settledAt = Timestamp.now();
                            }

                            return acc;
                        }),
                    };

                    // Transfer balance from settler to receiver
                    const balanceToAdd: Balance = house.balances[data.settlerAccountId];

                    updateObject[`balances.${data.receiverAccountId}.totalIn`]
                        = FieldValue.increment(balanceToAdd.totalIn);
                    updateObject[`balances.${data.receiverAccountId}.totalOut`]
                        = FieldValue.increment(balanceToAdd.totalOut);

                    if (balanceToAdd.products) {
                        Object.keys(balanceToAdd.products)
                            .forEach((productId: string) => {
                                const product = balanceToAdd.products!![productId] === undefined ? {
                                    totalIn: 0,
                                    totalOut: 0,
                                    amountIn: 0,
                                    amountOut: 0,
                                } : balanceToAdd.products!![productId];

                                updateObject[`balances.${data.receiverAccountId}.products.${productId}.totalIn`]
                                    = FieldValue.increment(product.totalIn ?? 0);
                                updateObject[`balances.${data.receiverAccountId}.products.${productId}.totalOut`]
                                    = FieldValue.increment(product.totalOut ?? 0);
                                updateObject[`balances.${data.receiverAccountId}.products.${productId}.amountIn`]
                                    = FieldValue.increment(product.amountIn ?? 0);
                                updateObject[`balances.${data.receiverAccountId}.products.${productId}.amountOut`]
                                    = FieldValue.increment(product.amountOut ?? 0);
                            });
                    }

                    const accountSettlement: UserAccountSettlement = {
                        createdAt: FieldValue.serverTimestamp(),
                        createdBy: issuerAccount.id,
                        type: 'userAccount',
                        settledAtBefore: oldAccountSettledAt ? oldAccountSettledAt: Timestamp.now(),
                        settlerAccountId: data.settlerAccountId,
                        receiverAccountId: data.receiverAccountId,
                        balanceSettled: oldAccountBalance,
                        accounts: {},
                    };

                    accounts.forEach((acc: Account) => {
                        accountSettlement.accounts[acc.id] = {
                            name: acc.name,
                        };
                    });

                    fireTrans.create(houseRef.collection('settlements').doc(uuidv4()), accountSettlement);

                    // Update the house
                    fireTrans.update(houseRef, updateObject);
                })
                .catch(err => {
                    console.error(err);
                    throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
                });
        });
    });
