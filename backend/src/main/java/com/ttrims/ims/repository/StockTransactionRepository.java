package com.ttrims.ims.repository;

import com.ttrims.ims.entity.StockTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.Optional;

public interface StockTransactionRepository extends JpaRepository<StockTransaction, String> {
    Optional<StockTransaction> findByGrNumber(String grNumber);
    long countByTransactionDate(LocalDate date);

    @Query("SELECT t FROM StockTransaction t WHERE " +
           "(CAST(:type AS string) IS NULL OR t.type = :type) AND " +
           "(CAST(:productId AS string) IS NULL OR t.product.id = :productId) AND " +
           "(CAST(:warehouseId AS string) IS NULL OR t.warehouse.id = :warehouseId) AND " +
           "(CAST(:dateFrom AS date) IS NULL OR t.transactionDate >= :dateFrom) AND " +
           "(CAST(:dateTo AS date) IS NULL OR t.transactionDate <= :dateTo) AND " +
           "(CAST(:search AS string) IS NULL OR LOWER(t.grNumber) LIKE LOWER(CONCAT('%',CAST(:search AS string),'%')) OR " +
           "LOWER(t.product.name) LIKE LOWER(CONCAT('%',CAST(:search AS string),'%')) OR " +
           "LOWER(t.product.code) LIKE LOWER(CONCAT('%',CAST(:search AS string),'%')))" +
           " ORDER BY t.createdAt DESC")
    Page<StockTransaction> findWithFilters(
        @Param("type") StockTransaction.Type type,
        @Param("productId") String productId,
        @Param("warehouseId") String warehouseId,
        @Param("dateFrom") LocalDate dateFrom,
        @Param("dateTo") LocalDate dateTo,
        @Param("search") String search,
        Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.quantity),0) FROM StockTransaction t WHERE t.type = 'IN' AND t.transactionDate = :date")
    Double sumInByDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(t.quantity),0) FROM StockTransaction t WHERE t.type = 'OUT' AND t.transactionDate = :date")
    Double sumOutByDate(@Param("date") LocalDate date);

    @Query("SELECT t FROM StockTransaction t WHERE t.referenceDoc LIKE 'PROD-RUN-%' ORDER BY t.createdAt DESC")
    java.util.List<StockTransaction> findProductionTransactions();

    @Query("SELECT t FROM StockTransaction t ORDER BY t.createdAt DESC, t.grNumber DESC")
    java.util.List<StockTransaction> findLatestTransaction(org.springframework.data.domain.Pageable pageable);
}
