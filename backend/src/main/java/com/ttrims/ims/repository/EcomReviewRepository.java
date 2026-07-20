package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomReview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EcomReviewRepository extends JpaRepository<EcomReview, String> {
    List<EcomReview> findByProductIdOrderByCreatedAtDesc(String productId);
}
