package app.partyplaner.equipment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import org.junit.jupiter.api.Test;

class EquipmentSlotTest {

    @Test
    void standsAcceptEveryPartSlotButNotThePhoto() {
        EnumSet<EquipmentSlot> allowed = EnumSet.noneOf(EquipmentSlot.class);
        for (EquipmentSlot slot : EquipmentSlot.values()) {
            if (slot.allowedFor(EquipmentCategory.STAND)) allowed.add(slot);
        }
        assertThat(allowed).containsExactlyInAnyOrder(EquipmentSlot.TOP_BAR_ADD_1, EquipmentSlot.TOP_BAR_ADD_2, EquipmentSlot.TOP_BAR,
                EquipmentSlot.FOOT, EquipmentSlot.LIGHT_1, EquipmentSlot.LIGHT_2, EquipmentSlot.LIGHT_3, EquipmentSlot.LIGHT_4, EquipmentSlot.LIGHT_5);
    }

    @Test
    void otherEquipmentAcceptsOnlyThePhoto() {
        for (EquipmentSlot slot : EquipmentSlot.values()) {
            assertThat(slot.allowedFor(EquipmentCategory.OTHER)).isEqualTo(slot == EquipmentSlot.PHOTO);
        }
    }
}
