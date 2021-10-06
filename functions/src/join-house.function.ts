import {AuthUser, Balance, House, UserAccount} from './models';
import {ErrorMessage} from './models/error-message';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const {v4: uuidv4} = require('uuid');
const db = admin.firestore();

interface JoinHouseData {
    houseId: string;
    user: AuthUser;
    inviteLink: string;
}

/**
 * joinHouse
 *
 * HTTP Trigger function when a user wants to join a house. This function will cross-check the houseCodes collection with the house using
 * this code to see if the houseCode is valid and not expired.
 *
 * @var houseId: string
 * @var user: Firebase User object
 * @var inviteLink: string - Invite code for the house
 *
 * @returns added UserAccount
 * @throws UNAUTHENTICATED if the initiator of this call is not authenticated with Firebase Auth
 * @throws PERMISSION_DENIED if this user is not allowed to do operations
 * @throws INVALID_DATA if the data provided in the call was incomplete
 * @throws INTERNAL if something went wrong which we cannot completely explain
 * @throws HOUSE_NOT_FOUND if the house with variable houseId was not found
 * @throws INVALID_HOUSE_CODE if the house code was not found in the house object
 * @throws EXPIRED_HOUSE_CODE if the house code used in the call is expired
 */
export const joinHouse = functions.region('europe-west1').https.onCall((data: JoinHouseData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    if (!data.houseId || !data.user || !data.inviteLink) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    const user: AuthUser = data.user;

    const houseRef = db.collection('houses').doc(data.houseId);

    return db.runTransaction(fireTrans => {
        return fireTrans.get(houseRef)
            .then(houseDoc => {
                const house: House = houseDoc.data() as House;

                // Check if the house exists
                if (!houseDoc.exists || !house) {
                    throw new functions.https.HttpsError('not-found', ErrorMessage.HOUSE_NOT_FOUND);
                }

                // Check if the inviteLink is linked to the house, protecting the house from forged house invites
                if (house.inviteLink !== data.inviteLink) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.INVALID_HOUSE_CODE);
                }

                if (house.members.includes(user.uid)) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.ALREADY_MEMBER_OF_HOUSE);
                }

                const now = admin.firestore.Timestamp.now();
                if (house.inviteLinkExpiry < now) {
                    throw new functions.https.HttpsError('permission-denied', ErrorMessage.EXPIRED_HOUSE_CODE);
                }

                const accountId = uuidv4();
                const account: UserAccount = {
                    id: accountId,
                    name: user.displayName,
                    photoUrl: user.photoURL,
                    roles: house.accounts.length === 0 ? ['ADMIN'] : [],
                    userId,
                    createdAt: now,
                    type: 'user',
                };

                const accountBalance: Balance = {
                    totalIn: 0,
                    totalOut: 0,
                };

                fireTrans.update(houseRef, {
                    accounts: admin.firestore.FieldValue.arrayUnion(account),
                    members: admin.firestore.FieldValue.arrayUnion(userId),
                    [`balances.${accountId}`]: accountBalance,
                });

                return account;
            })
            .catch((err: any) => {
                console.error(err);
                throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
            });
    });
});

