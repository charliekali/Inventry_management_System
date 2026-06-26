package com.ttrims.ims.repository;

import com.ttrims.ims.entity.KeyLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface KeyLogRepository extends JpaRepository<KeyLog, String> {
    /** Full history, newest first */
    List<KeyLog> findAllByOrderByTakenAtDesc();
    /** Currently checked-out entries (not yet returned) */
    List<KeyLog> findByReturnedAtIsNullOrderByTakenAtDesc();
    /** All logs for a specific key */
    List<KeyLog> findByKeyIdOrderByTakenAtDesc(String keyId);
    /** Find the open (unreturned) checkout for a key */
    Optional<KeyLog> findByKeyIdAndReturnedAtIsNull(String keyId);
    
    List<KeyLog> findByStatusOrderByCreatedAtDesc(String status);
    List<KeyLog> findByTakenByIdOrderByCreatedAtDesc(String takenById);
    List<KeyLog> findByStatusInOrderByCreatedAtDesc(List<String> statuses);
}
