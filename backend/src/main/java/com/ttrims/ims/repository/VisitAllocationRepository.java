package com.ttrims.ims.repository;

import com.ttrims.ims.entity.VisitAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface VisitAllocationRepository extends JpaRepository<VisitAllocation, String> {
    List<VisitAllocation> findBySalespersonIdAndVisitDateOrderBySequenceAsc(String salespersonId, LocalDate visitDate);
    List<VisitAllocation> findBySalespersonIdOrderByVisitDateDescSequenceAsc(String salespersonId);
    List<VisitAllocation> findByVisitDateOrderBySalespersonIdAscSequenceAsc(LocalDate visitDate);
    List<VisitAllocation> findAllByOrderByVisitDateDescSequenceAsc();

    @Query("SELECT COALESCE(MAX(v.sequence), 0) FROM VisitAllocation v WHERE v.salesperson.id = :salespersonId AND v.visitDate = :visitDate")
    Integer findMaxSequenceBySalespersonIdAndVisitDate(@Param("salespersonId") String salespersonId, @Param("visitDate") LocalDate visitDate);
}
