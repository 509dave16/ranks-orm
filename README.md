# RanksDB
## Demo
Here is a rough demo that utilizes the full example of this library mentioned below: [Ionic PouchDB](https://ionic-pouchdb-d0f37.firebaseapp.com)
## Full Example
At the moment the `RelationalService.ts` in the following repo, is probably the best example that you can follow for how RanksDB is used.
[ionicPouchDB repo RelationalService](https://github.com/509dave16/ionicPouchDB/blob/master/src/services/relational.service.ts)

## Summary
This package is essentially an ORM wrapper around relational-pouch. Allowing the user to leverage the following:
- Auto-incremented friendly Doc IDs : Any docs that are saved of any `relational-pouch` schema type will have Doc IDs automatically determined for them. A local cache of the max Doc ID for each schema type is maintained as you perform writes.
- Doc ID conflict resolution: This covers the case where two active clients are consuming the same PouchDB database. The gist of it is that when a conflict occurs when we are creating a new Doc, we know that it's because another Doc was already created with the same ID. This also takes into account that any `related` Docs maintained in memory that depend on this newly created Doc will also need the Doc IDs that they are referring to updated. **NOTE: This does not account  for the case yet where an Offline Client consuming the same PouchDB database as Online Client comes back online.**
- In-Memory Relation Map: When preforming a `find` action like you would in `relational-pouch`, internally a bulk fetch is performed using `allDocs`. And subsequently all the related Docs are sideloaded in the response. RanksDB allows a continuation of this theme. Say if you did this `await authorModel.attach('books', bookModel)`. Or this `await authorModel.get('publishers')`. Each action would update the map with a new created/fetched DocModel/DocCollection. Meaning no extra queries against PouchDB have to be performed.  So say you were in a Client Side situation where you have a Store, you could perform a bunch of operations without having to explicitly re-query PouchDB for the fetched/changed/created Docs. That's handled for you by RanksDB.
- Relational Operations:
  - DocCollection: Can have DocModels added/removed from them. If the DocCollection was the results of a `get` like `await author.get('publishers')`,  then the In-Memory Relation Map would be  updated to either refer or no longer refer to say an added or removed `publisher`.
  - DocModel: Can have DocModels attached/detached/gotten. If this Model was found(i.e. `find`) or retrieved off something else `get` then like with DocCollections the In-Memory Relation  Map will be updated.
- Bulk Writes : `relational-pouch` provided bulk reads with the `find` api that is exposed. But it did not provide bulk writes. RanksDB does this automatically when you do an add/remove/attach/detach. **NOTE: There will eventually be an option to choose not to have any writes performed on add/remove/attach/detach. Allowing you to wait to save everything all at once at a later point in time.**
## Cautions
- This package has no tests currently.
- This package is in development.
- This package is not considered to be production ready.
- There are other packages `SlothDB` and `RxDB` that might be better suited to your needs if
  - **Multi DBs**: You are wanting to maintain multiple PouchDB database instances per a User instead of just one like what `relational-pouch` does.
  - **Better Peformance**: Those aforementioned packages would also improve performance in that parallel DB operations could be performed as mentioned in this [post](https://nolanlawson.com/2016/02/08/how-to-think-about-databases/) by Nolan Lawson
  - **Better Typing** : `SlothDB` enforces strict typing through decorators on the Entities that you define.
  - **Better Reactivity** : `RxDB` is all about Observables, providing you with Observable streams of say the replication events that PouchDB emits.
  - **Better Tooling**: `RxDB` leverages the JSON schema [spec](http://json-schema.org/) as a part of it's tooling for migrations. So if you want to better track and handle schema changes `RxDB` would do it
  
## Conclusion
This package was written whilst unaware of `SlothDB` and `RxDB`. This package may not be actively developed as I am most likely going to be transitioning to using one of those packages. Where I might introduce the concepts I implemented here in `RanksDB`.  This ultimately was an attempt by me to write an ORM wrapper around `relational-pouch` in order to work with Relational Database type capabilities as seen in server  side ORMs like Bookshelf.js, Eloquent, etc...
