package com.ttrims.ims.repository;

import com.ttrims.ims.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
    List<AppSetting> findBySettingKeyStartingWith(String prefix);
    Optional<AppSetting> findBySettingKey(String settingKey);
}
