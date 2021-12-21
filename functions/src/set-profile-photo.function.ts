import {House} from './models';
import {ErrorMessage} from './models/error-message';
import * as functions from 'firebase-functions';

const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

interface SetProfilePhotoData {
    downloadUrl: string;
}

/**
 * setProfilePhoto
 *
 * HTTP Trigger function when a user changes his profile photo. This function will iterate through all his houses to change its
 * profile photo url.
 *
 * @var downloadUrl: string
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
export const setProfilePhoto = functions.region('europe-west1').https.onCall((data: SetProfilePhotoData, context) => {

    const userId: string | undefined = context.auth?.uid;
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    if (!data.downloadUrl) {
        throw new functions.https.HttpsError('failed-precondition', ErrorMessage.INVALID_DATA);
    }

    getAuth().updateUser(userId, {
        photoURL: data.downloadUrl,
    }).catch(err => {
        console.error(err);
    });

    return db.runTransaction(fireTrans => {

        const housesRef = db.collection('houses')
            .where('members', 'array-contains', userId);

        return fireTrans.get(housesRef)
            .then(houseDocs => {
                if (!houseDocs.empty) {
                    houseDocs.docs.forEach(houseDoc => {
                        const house: House = houseDoc.data() as House;

                        house.accounts = house.accounts.map(acc => {
                            if (acc.userId === userId) {
                                acc.photoUrl = data.downloadUrl;
                            }
                            return acc;
                        });

                        fireTrans.update(houseDoc.ref, {
                            [`accounts`]: house.accounts,
                        });
                    });
                }
            })
            .catch((err: any) => {
                console.error(err);
                throw new functions.https.HttpsError('internal', ErrorMessage.INTERNAL);
            });
    });
});

