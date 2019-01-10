import * as admin from "firebase-admin";
import { DurationInputArg1, DurationInputArg2 } from "moment";
import UserRecord = admin.auth.UserRecord;
import moment = require("moment");
import ListUsersResult = admin.auth.ListUsersResult;
import Bluebird = require("bluebird");

interface Filter {
    eMailVerified: boolean;
    emptyProvider: boolean;
}

interface UserAge {
    amount: DurationInputArg1;
    unit: DurationInputArg2;
}

interface Options {
    userAge: UserAge;

    maxRuns: number;
    concurrentDeletions: number;

    filter: Filter;
}

export class InactiveUsers {
    private currentRun: number = 0;
    private userList: Array<UserRecord> = [];

    constructor( private options: Options = { userAge: { amount: 90, unit: "days" }, maxRuns: 10, concurrentDeletions: 3, filter: { eMailVerified: true, emptyProvider: false } } ) {

    }

    private deleteFromFirestore( collections: Array<admin.firestore.CollectionReference>, uid: string ): Promise<boolean> {
        return new Promise( ( resolve ) => {
            Bluebird.map( collections, ( collection ) => {
                return collection.doc( uid ).delete();
            } ).then( () => {
                resolve();
            } );
        } ).then( () => {
            return true;
        } );
    }

    private getInactiveUsers( users: Array<UserRecord> = [], nextPageToken?: string ): Promise<Array<UserRecord>> {
        return admin.auth().listUsers( 1000, nextPageToken ).then( ( result: ListUsersResult ) => {
            console.log( `Found ${result.users.length} users` );

            const inactiveUsers = result.users.filter( ( user: UserRecord ) => {
                let deleteUser = false;

                if ( moment( user.metadata.lastSignInTime ).isBefore( moment().subtract( this.options.userAge.amount, this.options.userAge.unit ) ) ) {
                    if ( this.options.filter.emptyProvider && !user.emailVerified ) {
                        deleteUser = true;
                    }

                    if ( this.options.filter.emptyProvider && user.providerData.length === 0 ) {
                        deleteUser = true;
                    }
                }

                return deleteUser;
            } );

            console.log( `Found ${inactiveUsers.length} inactive users` );

            this.userList = this.userList.concat( inactiveUsers );

            if ( result.pageToken && this.currentRun < this.options.maxRuns ) {
                this.currentRun++;
                return this.getInactiveUsers( this.userList, result.pageToken );
            }

            return this.userList;
        } );
    }

    public delete( withFirestore: Array<admin.firestore.CollectionReference> = [] ): Promise<Array<string>> {
        const deletedUsers: Array<string> = [];

        return this.getInactiveUsers().then( ( users: Array<UserRecord> ) => {
            return Bluebird.map( users, ( user ) => {
                return this.deleteFromFirestore( withFirestore, user.uid ).then( () => {
                    return admin.auth().deleteUser( user.uid ).then( () => {
                        console.log( "Deleted user account", user.uid, "because of inactivity" );
                        deletedUsers.push( user.uid );
                    } ).catch( ( error ) => {
                        console.error( "Deletion of inactive user account", user.uid, "failed:", error );
                    } );
                } );
            }, { concurrency: this.options.concurrentDeletions } ).then( () => {
                return deletedUsers;
            });
        } );
    }
}