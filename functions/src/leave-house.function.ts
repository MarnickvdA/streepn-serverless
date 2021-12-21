import * as functions from 'firebase-functions';
import {ErrorMessage} from './models/error-message';
import {House, UserAccount} from './models';
import {
    checkIfAccountCanLeaveHouse,
    checkIfHouseExists,
    checkIfUserIsMemberOfHouse,
    getUserAccountByUserId,
} from "./helpers/house.helper";

const {FieldValue, getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

interface LeaveHouseData {
    houseId: string;
    userId: string;
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

    const uid: string | undefined = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    if (!data.houseId || !data.userId) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    const houseRef = db.collection('houses').doc(data.houseId);

    return db.runTransaction(fireTrans => {
        return fireTrans.get(houseRef)
            .then(houseDoc => {
                const house: House = houseDoc.data() as House;

                checkIfHouseExists(houseDoc, house);

                checkIfUserIsMemberOfHouse(house, data.userId);

                const account: UserAccount = getUserAccountByUserId(house, data.userId);

                if (house.members.length > 1) {
                    // Check if the current user is allowed to leave
                    checkIfAccountCanLeaveHouse(house, account);

                    // Remove the balance of this account from the map of balances
                    delete house.balances[account.id];

                    // Add removed account to the list of removed items.
                    if (!house.removedItems) {
                        house.removedItems = [];
                    }

                    house.removedItems.push({
                        id: account.id,
                        name: account.name,
                    });

                    // Update the database
                    fireTrans.update(houseRef, {
                        members: FieldValue.arrayRemove(data.userId),
                        accounts: FieldValue.arrayRemove(account),
                        balances: house.balances,
                        removedItems: house.removedItems,
                    });
                } else {
                    // If the user was the last account in the house, just leave and archive the house.
                    // TODO Cron job for clean-up of archived houses: after 30 days delete the house?
                    fireTrans.update(houseRef, {
                        members: [],
                        archived: true,
                        archivedAt: FieldValue.serverTimestamp(),
                        inviteLink: '404 not found! Die is er lekker niet meer haha!',
                        inviteLinkExpiry: FieldValue.serverTimestamp(),
                    });
                }

                return account;
            });
    });
});
