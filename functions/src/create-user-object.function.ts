import * as functions from 'firebase-functions';
import {User} from "./models";

const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');

const db = getFirestore();
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
            pushToken: '',
        };

        return Promise.all([
            db.collection('users').doc(user.uid).create(userObject),
            getAuth().setCustomUserClaims(user.uid, {
                acceptedTermsAndPrivacy: false,
                termsAndPrivacyVersion: '1',
            }),
        ]).catch((err) => {
            console.error(err);
            throw new functions.https.HttpsError('internal', 'Something went terribly wrong');
        });
    });
