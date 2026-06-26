package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Bom;
import com.ttrims.ims.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface BomRepository extends JpaRepository<Bom, String> {
    List<Bom> findByFinishedGood(Product finishedGood);
    List<Bom> findByFinishedGoodId(String finishedGoodId);
    void deleteByIdAndFinishedGoodId(String id, String finishedGoodId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Bom b WHERE b.finishedGood.id = :productId OR b.rawMaterial.id = :productId")
    void deleteByProductId(@Param("productId") String productId);
}
