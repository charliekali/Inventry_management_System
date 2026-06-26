package com.ttrims.ims.repository;

import com.ttrims.ims.entity.StockBalance;
import com.ttrims.ims.entity.Product;
import com.ttrims.ims.entity.Warehouse;
import com.ttrims.ims.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

public interface StockBalanceRepository extends JpaRepository<StockBalance, String> {
    Optional<StockBalance> findByProductAndWarehouseAndSection(Product product, Warehouse warehouse, Section section);

    @Modifying
    @Transactional
    @Query("DELETE FROM StockBalance sb WHERE sb.product.id = :productId")
    void deleteByProductId(@Param("productId") String productId);

    @Query("SELECT sb FROM StockBalance sb WHERE sb.product.id = :productId AND sb.warehouse.id = :warehouseId AND (CAST(:sectionId AS string) IS NULL AND sb.section IS NULL OR sb.section.id = :sectionId)")
    Optional<StockBalance> findByLocation(@Param("productId") String productId, @Param("warehouseId") String warehouseId, @Param("sectionId") String sectionId);

    List<StockBalance> findByProductId(String productId);

    @Query("SELECT COALESCE(SUM(sb.quantity), 0) FROM StockBalance sb WHERE sb.product.id = :productId")
    Double sumByProductId(@Param("productId") String productId);

    @Query("SELECT sb FROM StockBalance sb WHERE sb.quantity > 0 AND sb.product.active = true AND sb.warehouse.active = true")
    List<StockBalance> findAllActive();

    @Query("SELECT sb.product.id, COALESCE(SUM(sb.quantity), 0) FROM StockBalance sb GROUP BY sb.product.id")
    List<Object[]> sumQuantitiesGroupedByProduct();

    @Query("SELECT sb.warehouse.id, COALESCE(SUM(sb.quantity), 0) FROM StockBalance sb GROUP BY sb.warehouse.id")
    List<Object[]> sumQuantitiesGroupedByWarehouse();

    @Query("SELECT sb FROM StockBalance sb WHERE sb.product.id = :productId AND sb.quantity > 0")
    List<StockBalance> findLocationsByProductId(@Param("productId") String productId);
}
