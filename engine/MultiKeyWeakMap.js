function getLastMap(map, keys, create) {
    for (const key of keys) {
        if (!map.has(key)) {
            if (create) {
                map.set(key, new WeakMap());
            } else {
                return undefined;
            }
        }
        map = map.get(key);
    }
    return map;
}

export class MultiKeyWeakMap {

    constructor(entries = []) {
        this.map = new WeakMap();
        for (const [keys, value] of entries) {
            this.set(keys, value);
        }
    }

    set(keys, value) {
        getLastMap(this.map, keys, true).set(this, value);
        return this;
    }

    get(keys) {
        return getLastMap(this.map, keys)?.get(this);
    }

    has(keys) {
        return !!getLastMap(this.map, keys)?.has(this);
    }

    delete(keys) {
        return !!getLastMap(this.map, keys)?.delete(this);
    }

}
