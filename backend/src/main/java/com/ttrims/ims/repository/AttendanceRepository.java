package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, String> {

    /** Find an active session for a specific user (to prevent duplicate sessions). */
    Optional<Attendance> findByUserIdAndStatus(String userId, String status);

    /** All currently active sessions for the admin live-tracking map. */
    List<Attendance> findByStatusOrderByClockInAtDesc(String status);

    /** All sessions regardless of status, newest first — for history view. */
    List<Attendance> findAllByOrderByCreatedAtDesc();

    /** Sessions for a specific user — for profile/history. */
    List<Attendance> findByUserIdOrderByCreatedAtDesc(String userId);
}
