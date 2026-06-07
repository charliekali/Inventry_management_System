package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Bom;
import com.ttrims.ims.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BomRepository extends JpaRepository<Bom, String> {
    List<Bom> findByFinishedGood(Product finishedGood);
    List<Bom> findByFinishedGoodId(String finishedGoodId);
    void deleteByIdAndFinishedGoodId(String id, String finishedGoodId);
}
