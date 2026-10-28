package app.partyplaner.equipment;

/** Image positions of a {@link EquipmentCategory#STAND}; {@link #PHOTO} is the single image of anything else. */
public enum EquipmentSlot {
    TOP_BAR_ADD_1, TOP_BAR_ADD_2, TOP_BAR, FOOT, LIGHT_1, LIGHT_2, LIGHT_3, LIGHT_4, LIGHT_5,
    /** The single photo of an {@link EquipmentCategory#OTHER} item. */
    PHOTO;

    public boolean allowedFor(EquipmentCategory category) {
        return (this == PHOTO) == (category == EquipmentCategory.OTHER);
    }
}
