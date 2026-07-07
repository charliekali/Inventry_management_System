package com.ttrims.ims.repository;

import com.ttrims.ims.entity.IpWhitelist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IpWhitelistRepository extends JpaRepository<IpWhitelist, String> {
    List<IpWhitelist> findByUserId(String userId);
    boolean existsByUserIdAndIpAddress(String userId, String ipAddress);
    boolean existsByUserId(String userId);
    List<IpWhitelist> findAllByOrderByCreatedAtDesc();
}
