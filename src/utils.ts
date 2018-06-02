export function throwErrorIfUndefined(value, ofName) {
    if (value === undefined || value === null) {
        throw new Error(`${ofName} is undefined.`);
    }
}