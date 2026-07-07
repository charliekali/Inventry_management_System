package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, String> {
    @EntityGraph(attributePaths = {"items"})
    List<Order> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"items"})
    List<Order> findByDispatchStatusOrderByCreatedAtDesc(String dispatchStatus);

    List<Order> findByAssignedToIdOrderByCreatedAtDesc(String userId);

    Optional<Order> findFirstByInvoiceNumberStartingWithOrderByInvoiceNumberDesc(String prefix);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0.0) FROM Order o WHERE o.status = 'FULFILLED' AND o.invoiceDate >= :start AND o.invoiceDate <= :end")
    Double calculateRevenueBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0.0) FROM Order o WHERE o.status = 'FULFILLED'")
    Double calculateAllTimeRevenue();

    @Query("SELECT COUNT(o) FROM Order o WHERE o.createdAt >= :start AND o.createdAt <= :end")
    long countOrdersCreatedBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.isPosOrder = true")
    long countPosOrders();

    List<Order> findTop10ByInvoiceNumberIsNotNullOrderByInvoiceDateDesc();
}

