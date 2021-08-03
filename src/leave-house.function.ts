import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import {Balance, House, UserAccount} from './models';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface LeaveHouseData {
    houseId: string;
}

/**
 * leaveHouse
 *
 * HTTP Trigger function when a user account issues to leave a house
 *
 * @var houseId: string
 *
 * @returns deleted UserAccount
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INVALID_DATA if the data provided in the call was incomplete
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws NOT_MEMBER_OF_HOUSE if the user is not member of this house
 * @throws USER_ACCOUNT_NOT_FOUND if the user account for the authenticated user was not found
 * @throws HOUSE_LEAVE_DENIED if the user has not met the criteria for a house leave
 */
export const leaveHouse = functions.region('europe-west1').https.onCall((data: LeaveHouseData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    if (!data.houseId) {
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

                const account: UserAccount | undefined = house.accounts.find((acc: UserAccount) => acc.userId === context.auth?.uid);

                if (house.members.length > 1) {
                    if (!account) {
                        throw new functions.https.HttpsError('not-found', ErrorMessage.USER_ACCOUNT_NOT_FOUND);
                    }

                    const accountBalance: Balance | undefined = house.balances[account.id];

                    // Check if the current user is allowed to leave
                    // TODO Check if this check is complete. Maybe ignoring the products without a price.
                    if (!accountBalance || accountBalance?.totalIn !== 0 || accountBalance?.totalOut !== 0) {
                        throw new functions.https.HttpsError('permission-denied', ErrorMessage.HOUSE_LEAVE_DENIED);
                    }

                    // Remove the balance of this account from the map of balances
                    delete house.balances[account.id];

                    // Update the database
                    fireTrans.update(houseRef, {
                        members: admin.firestore.FieldValue.arrayRemove(userId),
                        accounts: admin.firestore.FieldValue.arrayRemove(account),
                        balances: house.balances,
                    });
                } else {
                    // If the user was the last account in the house, just leave and archive the house.
                    // TODO Cron job for clean-up of archived houses: after 30 days delete the house?
                    fireTrans.update(houseRef, {
                        members: [],
                        archived: true,
                        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        inviteLink: '404 not found! Die is er lekker niet meer haha!',
                        inviteLinkExpiry: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                return account;
            });
    });
});