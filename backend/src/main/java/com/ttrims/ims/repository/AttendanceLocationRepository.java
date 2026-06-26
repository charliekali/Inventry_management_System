package com.ttrims.ims.repository;

import com.ttrims.ims.entity.AttendanceLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AttendanceLocationRepository extends JpaRepository<AttendanceLocation, String> {

    /** All GPS pings for a session, ordered oldest → newest (for drawing the path trail). */
    List<AttendanceLocation> findByAttendanceIdOrderByRecordedAtAsc(String attendanceId);

    /** Most recent GPS ping for a session. */
    Optional<AttendanceLocation> findFirstByAttendanceIdOrderByRecordedAtDesc(String attendanceId);

    /** Count pings for a session. */
    long countByAttendanceId(String attendanceId);

    /** Delete all pings for a session (cascade cleanup). */
    void deleteByAttendanceId(String attendanceId);
}
