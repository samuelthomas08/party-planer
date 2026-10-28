package app.partyplaner.admin;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link AppSetting}. */
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
