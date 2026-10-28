package app.partyplaner.audit;

/**
 * One line of "what exactly changed". {@code code} is a stable key the frontend translates;
 * {@code ref} names the thing within the entity (e.g. marker number), {@code from}/{@code to} the values.
 */
public record Change(String code, String ref, String from, String to) {

    public static Change of(String code) {
        return new Change(code, null, null, null);
    }

    public static Change of(String code, String from, String to) {
        return new Change(code, null, from, to);
    }

    public static Change ofRef(String code, String ref, String from, String to) {
        return new Change(code, ref, from, to);
    }
}
