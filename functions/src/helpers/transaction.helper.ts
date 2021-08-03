import {House, Transaction} from '../models';
import * as functions from 'firebase-functions';
import {ErrorMessage} from '../models/error-message';
import * as admin from 'firebase-admin';

export function getTransactionUpdateObject(house: House, transaction: Transaction): {
    [key: string]: unknown;
} {
    const updateObject: {
        [key: string]: unknown;
    } = {};
    let totalOut = 0;

    const productData: {
        [id: string]: {
            amountOut: number,
            totalOut: number,
        }
    } = {};

    const accountData: {
        [id: string]: {
            totalOut: number,
        }
    } = {};

    transaction.items
        .forEach((t: { amount: number, accountId: string, productId: string, productPrice: number }) => {
            let acc: any = house.accounts.find((account: any) => account.id === t.accountId);

            if (!acc) {
                acc = house.sharedAccounts.find((account: any) => account.id === t.accountId);
            }

            if (!acc) {
                throw new functions.https.HttpsError('not-found', ErrorMessage.SHARED_ACCOUNT_NOT_FOUND);
            }

            const productPrice = t.productPrice * t.amount;
            totalOut += productPrice;

            if (!productData[t.productId]) {
                productData[t.productId] = {
                    amountOut: 0,
                    totalOut: 0,
                };
            }

            if (!accountData[t.accountId]) {
                accountData[t.accountId] = {
                    totalOut: 0,
                };
            }

            productData[t.productId].totalOut += productPrice;
            productData[t.productId].amountOut += t.amount;

            accountData[t.accountId].totalOut += productPrice;

            updateObject[`balances.${acc.id}.products.${t.productId}.amountOut`]
                = admin.firestore.FieldValue.increment(t.amount);
            updateObject[`balances.${acc.id}.products.${t.productId}.totalOut`]
                = admin.firestore.FieldValue.increment(t.productPrice * t.amount);
        });


    Object.keys(productData).forEach((productId: string) => {
        updateObject[`productData.${productId}.totalOut`]
            = admin.firestore.FieldValue.increment(productData[productId].totalOut);
        updateObject[`productData.${productId}.amountOut`]
            = admin.firestore.FieldValue.increment(productData[productId].amountOut);
    });

    Object.keys(accountData).forEach((accountId: string) => {
        updateObject[`balances.${accountId}.totalOut`]
            = admin.firestore.FieldValue.increment(accountData[accountId].totalOut);
    });

    updateObject.totalOut = admin.firestore.FieldValue.increment(totalOut);

    return updateObject;
}
