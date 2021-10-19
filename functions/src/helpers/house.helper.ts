import {Balance, House, UserAccount} from "../models";
import * as functions from "firebase-functions";
import {ErrorMessage} from "../models/error-message";

export function checkIfHouseExists(houseDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>, house: House) {
    if (!houseDoc.exists || !house) {
        throw new functions.https.HttpsError('not-found', ErrorMessage.HOUSE_NOT_FOUND);
    }
}

export function checkIfUserIsMemberOfHouse(house: House, userId: string) {
    if (!house.members.includes(userId)) {
        throw new functions.https.HttpsError('permission-denied', ErrorMessage.NOT_MEMBER_OF_HOUSE);
    }
}

export function getUserAccountByUserId(house: House, userId: string): UserAccount {
    const account = house.accounts.find((acc: UserAccount) => acc.userId === userId);
    if (!account) {
        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
    } else {
        return account;
    }
}

export function checkIfAccountCanLeaveHouse(house: House, account: UserAccount) {
    const balance: Balance | undefined = house.balances[account.id];

    if (!balance || balance.totalIn !== 0 || balance.totalOut !== 0) {
        throw new functions.https.HttpsError('permission-denied', ErrorMessage.HOUSE_LEAVE_DENIED);
    }

    if (balance.products) {
        for (const productBalance of Object.values(balance.products)) {
            if (productBalance.totalIn !== 0
                && productBalance.totalOut !== 0
                && productBalance.amountIn !== 0
                && productBalance.amountOut !== 0) {
                throw new functions.https.HttpsError('permission-denied', ErrorMessage.HOUSE_LEAVE_DENIED);
            }
        }
    }
}