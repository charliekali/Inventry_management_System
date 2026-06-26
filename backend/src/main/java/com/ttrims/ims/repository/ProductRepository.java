package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
}
