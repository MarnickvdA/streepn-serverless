import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {User} from "./models";
import {firestore} from "firebase-admin/lib/firestore";
import Timestamp = firestore.Timestamp;

const db = admin.firestore();
/**
 * Triggers on register of a new user and sets their custom claims to check for terms & privacy.
 * @returns void
 * @throws INTERNAL
 */
export const createUserObject = functions
    .region('europe-west1')
    .auth
    .user().onCreate((user) => {
        const userObject: User = {
            userId: user.uid,
            createdAt: Timestamp.now(),
            email: user.email,
            pushToken: undefined,
        };

        return Promise.all([
            db.collection('houses').doc(user.uid).create(userObject),
            admin.auth().setCustomUserClaims(user.uid, {
                acceptedTermsAndPrivacy: false,
                termsAndPrivacyVersion: '1',
            }),
        ]).catch((err) => {
            console.error(err);
            throw new functions.https.HttpsError('internal', 'Something went terribly wrong');
        });
    });
