export default class SortedSet extends Set {
    constructor(compare) {
        super();
        this.compare = compare;
    }

    add(item) {
        const arr = Array.from( this );
        arr.push( item );
        arr.sort(this.compare);
        this.clear();
        for ( let item of arr ){
            super.add(item);
        }
    }
}
