var SomePromiseArray = (function() {
// the PromiseArray to use with Promise.some method

var Arr = Array;
var isArray = Arr.isArray || function( obj ) {
    return obj instanceof Arr;
};

function SomePromiseArray( values, caller ) {
    this.constructor$( values, caller );
}
inherits( SomePromiseArray, PromiseArray );

SomePromiseArray.prototype._init = function SomePromiseArray$_init() {
    this._init$( void 0, FULFILL_ARRAY );
    this._howMany = 0;
    //Need to keep track of holes in the array so
    //we know where rejection values start
    this._holes = isArray( this._values )
        ? this._values.length - this.length()
        : 0;
};

SomePromiseArray.prototype.howMany = function SomePromiseArray$howMany() {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany =
function SomePromiseArray$setHowMany( count ) {
    if( this._isResolved() ) return;

    this._howMany = Math.max(0, Math.min( count, this.length() ) );
    if( this.howMany() > this._canPossiblyFulfill()  ) {
        this._reject( [] );
    }
};

//override
SomePromiseArray.prototype._promiseFulfilled =
function SomePromiseArray$_promiseFulfilled( value ) {
    if( this._isResolved() ) return;
    this._addFulfilled( value );

    if( this._fulfilled() === this.howMany() ) {
        this._values.length = this.howMany();
        this._fulfill( this._values );
    }

};
//override
SomePromiseArray.prototype._promiseRejected =
function SomePromiseArray$_promiseRejected( reason ) {
    if( this._isResolved() ) return;
    this._addRejected( reason );

    if( this.howMany() > this._canPossiblyFulfill() ) {
        if( this._values.length === this.length() ) {
            this._reject([]);
        }
        else {
            this._reject( this._values.slice( this.length() + this._holes ) );
        }
    }
};

SomePromiseArray.prototype._fulfilled = function SomePromiseArray$_fulfilled() {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function SomePromiseArray$_rejected() {
    return this._values.length - this.length() - this._holes;
};

//Use the same array past .length() to store rejection reasons
SomePromiseArray.prototype._addRejected =
function SomePromiseArray$_addRejected( reason ) {
    this._values.push( reason );
};

SomePromiseArray.prototype._addFulfilled =
function SomePromiseArray$_addFulfilled( value ) {
    this._values[ this._totalResolved++ ] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill =
function SomePromiseArray$_canPossiblyFulfill() {
    return this.length() - this._rejected();
};
return SomePromiseArray;})();
