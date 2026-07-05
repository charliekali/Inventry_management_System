package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findByActiveTrueOrderByTypeAscNameAsc();

    List<Product> findByActiveFalseOrderByTypeAscNameAsc();

    List<Product> findByTypeAndActiveTrueOrderByName(Product.Type type);

    List<Product> findByTypeAndActiveFalseOrderByName(Product.Type type);

    boolean existsByCode(String code);

    Optional<Product> findByCodeAndActiveTrue(String code);

    Optional<Product> findByCode(String code);

    @Query("SELECT p FROM Product p WHERE p.active = :active AND (LOWER(p.name) LIKE LOWER(CONCAT('%',:q,'%')) OR LOWER(p.code) LIKE LOWER(CONCAT('%',:q,'%')))")
    List<Product> search(@Param("q") String query, @Param("active") boolean active);

    @Modifying
    @Transactional
    @Query("DELETE FROM Bom b WHERE b.finishedGood.id = :productId OR b.rawMaterial.id = :productId")
    void deleteBomByProductId(@Param("productId") String productId);

    @Modifying
    @Transactional
    @Query("DELETE FROM StockBalance sb WHERE sb.product.id = :productId")
    void deleteStockBalanceByProductId(@Param("productId") String productId);

    @Modifying
    @Transactional
    @Query("DELETE FROM StockTransaction st WHERE st.product.id = :productId")
    void deleteStockTransactionByProductId(@Param("productId") String productId);

    @Modifying
    @Transactional
    @Query("DELETE FROM ProductionOrderItem poi WHERE poi.product.id = :productId")
    void deleteProductionOrderItemByProductId(@Param("productId") String productId);

    @Modifying
    @Transactional
    @Query("DELETE FROM OrderItem oi WHERE oi.product.id = :productId")
    void deleteOrderItemByProductId(@Param("productId") String productId);
}
