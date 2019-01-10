# firebase-delete-inactive-users
Handy function to delete old unused firebase accounts

## How many user should be deleted at once?

You should be fine deleting 15k users in a run. Therefore please use 2G RAM and execution time of 540 seconds for the cloud function.

## Install

```bash
npm i --save @beyond-agentur-ug/firebase-delete-inactive-users
```

## Example use:

```ts
export const removeOldUsers = functions.pubsub.topic( "hourly-tick" ).onPublish( event => {
    const inactiveUsers = new InactiveUsers();
    
    return inactiveUsers.delete().then( ( deletedUsers ) => {
        console.log( `Deleted ${deletedUsers.length} inactive users` );
    } );
} );
```

### Delete users collection from firestore too

```ts
export const removeOldUsers = functions.pubsub.topic( "hourly-tick" ).onPublish( event => {
    const inactiveUsers = new InactiveUsers();
    
    return inactiveUsers.delete( [ db.collection( "users" ), db.collection( "posts" ) ] ).then( ( deletedUsers ) => {
        console.log( `Deleted ${deletedUsers.length} inactive users` );
    } );
} );
```
