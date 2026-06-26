package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, String> {
    List<ProductCategory> findByActiveTrueOrderByCategoryNameAscSortOrderAscSubcategoryNameAsc();
    List<ProductCategory> findByActiveFalseOrderByCategoryNameAscSortOrderAscSubcategoryNameAsc();
    boolean existsByCategoryNameAndSubcategoryName(String categoryName, String subcategoryName);
}
