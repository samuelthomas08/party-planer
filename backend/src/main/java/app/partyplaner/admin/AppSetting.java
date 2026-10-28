package app.partyplaner.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A runtime-changeable setting stored as a key/value pair (see {@link SettingsService}). */
@Entity
@Table(name = "app_settings")
public class AppSetting {

    @Id
    @Column(name = "key")
    private String key;

    @Column(name = "value", nullable = false)
    private String value;

    protected AppSetting() {
    }

    public AppSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
