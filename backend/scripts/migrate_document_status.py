#!/usr/bin/env python3
"""
Document Status Migration Script
Migrates existing documents to the new 3-stage pipeline status system.

Migration Logic:
- processed + vector_indexed=true → indexed
- processed + vector_indexed=false → processed
- Preserves existing embeddings

Usage:
    # Dry run (no changes)
    python migrate_document_status.py --dry-run
    
    # Execute migration
    python migrate_document_status.py
    
    # Verbose output
    python migrate_document_status.py --verbose

Requirements: 9.1, 9.2, 9.3
"""

import argparse
import logging
import sys
from datetime import datetime
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.insert(0, '/app')

from sqlalchemy import text
from backend.database.connection_v2 import SessionLocal
from backend.database.models_v2 import Document, DocumentChunk

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_migration_stats(db) -> Dict[str, Any]:
    """Get current document status statistics"""
    stats = {
        "total_documents": 0,
        "by_status": {},
        "with_embeddings": 0,
        "without_embeddings": 0,
        "needs_migration": 0
    }
    
    # Count by status
    documents = db.query(Document).all()
    stats["total_documents"] = len(documents)
    
    for doc in documents:
        status = doc.status or "unknown"
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
        
        # Check if has embeddings
        chunk_with_embedding = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == doc.id,
            DocumentChunk.embedding != None
        ).first()
        
        if chunk_with_embedding:
            stats["with_embeddings"] += 1
        else:
            stats["without_embeddings"] += 1
        
        # Check if needs migration (processed but has embeddings)
        if doc.status == "processed" and doc.vector_indexed:
            stats["needs_migration"] += 1
    
    return stats


def migrate_document_statuses(dry_run: bool = True, verbose: bool = False) -> Dict[str, Any]:
    """
    Migrate document statuses to new pipeline system.
    
    Args:
        dry_run: If True, only report what would be changed
        verbose: If True, print detailed information
    
    Returns:
        Migration results dictionary
    """
    db = SessionLocal()
    
    results = {
        "success": True,
        "dry_run": dry_run,
        "migrated": 0,
        "skipped": 0,
        "errors": [],
        "changes": []
    }
    
    try:
        logger.info("=" * 60)
        logger.info("Document Status Migration Script")
        logger.info("=" * 60)
        
        if dry_run:
            logger.info("🔍 DRY RUN MODE - No changes will be made")
        else:
            logger.info("⚠️  LIVE MODE - Changes will be applied")
        
        logger.info("")
        
        # Get pre-migration stats
        pre_stats = get_migration_stats(db)
        logger.info("📊 Pre-Migration Statistics:")
        logger.info(f"   Total documents: {pre_stats['total_documents']}")
        logger.info(f"   By status: {pre_stats['by_status']}")
        logger.info(f"   With embeddings: {pre_stats['with_embeddings']}")
        logger.info(f"   Without embeddings: {pre_stats['without_embeddings']}")
        logger.info(f"   Needs migration: {pre_stats['needs_migration']}")
        logger.info("")
        
        # Get all documents
        documents = db.query(Document).all()
        
        for doc in documents:
            try:
                old_status = doc.status
                new_status = None
                reason = None
                
                # Migration logic
                if doc.status == "processed":
                    # Check if has embeddings
                    chunk_with_embedding = db.query(DocumentChunk).filter(
                        DocumentChunk.document_id == doc.id,
                        DocumentChunk.embedding != None
                    ).first()
                    
                    if chunk_with_embedding or doc.vector_indexed:
                        # Has embeddings → indexed
                        new_status = "indexed"
                        reason = "Has embeddings (vector_indexed=true or chunks have embeddings)"
                    else:
                        # No embeddings → keep as processed
                        new_status = None
                        reason = "No embeddings, keeping as processed"
                
                elif doc.status == "indexed":
                    # Already indexed, skip
                    new_status = None
                    reason = "Already indexed"
                
                elif doc.status == "enriched":
                    # Already enriched, skip
                    new_status = None
                    reason = "Already enriched"
                
                elif doc.status in ["uploaded", "processing", "error"]:
                    # These statuses don't need migration
                    new_status = None
                    reason = f"Status '{doc.status}' doesn't need migration"
                
                else:
                    # Unknown status
                    new_status = None
                    reason = f"Unknown status '{doc.status}'"
                
                # Apply change if needed
                if new_status and new_status != old_status:
                    change = {
                        "document_id": doc.id,
                        "document_name": doc.name,
                        "old_status": old_status,
                        "new_status": new_status,
                        "reason": reason
                    }
                    results["changes"].append(change)
                    
                    if verbose:
                        logger.info(f"📄 Document {doc.id} ({doc.name}):")
                        logger.info(f"   {old_status} → {new_status}")
                        logger.info(f"   Reason: {reason}")
                    
                    if not dry_run:
                        doc.status = new_status
                        doc.updated_at = datetime.utcnow()
                        results["migrated"] += 1
                    else:
                        results["migrated"] += 1  # Count as would-be-migrated
                else:
                    results["skipped"] += 1
                    if verbose and reason:
                        logger.debug(f"⏭️  Document {doc.id}: {reason}")
                        
            except Exception as e:
                error_msg = f"Error processing document {doc.id}: {str(e)}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)
        
        # Commit changes if not dry run
        if not dry_run and results["migrated"] > 0:
            db.commit()
            logger.info("")
            logger.info(f"✅ Committed {results['migrated']} changes to database")
        
        # Get post-migration stats
        if not dry_run:
            db.expire_all()
            post_stats = get_migration_stats(db)
            logger.info("")
            logger.info("📊 Post-Migration Statistics:")
            logger.info(f"   By status: {post_stats['by_status']}")
        
        # Summary
        logger.info("")
        logger.info("=" * 60)
        logger.info("Migration Summary")
        logger.info("=" * 60)
        logger.info(f"   {'Would migrate' if dry_run else 'Migrated'}: {results['migrated']}")
        logger.info(f"   Skipped: {results['skipped']}")
        logger.info(f"   Errors: {len(results['errors'])}")
        
        if results["changes"]:
            logger.info("")
            logger.info("Changes:")
            for change in results["changes"]:
                logger.info(f"   - {change['document_name']}: {change['old_status']} → {change['new_status']}")
        
        if results["errors"]:
            results["success"] = False
            logger.error("")
            logger.error("Errors encountered:")
            for error in results["errors"]:
                logger.error(f"   - {error}")
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        db.rollback()
        results["success"] = False
        results["errors"].append(str(e))
        return results
        
    finally:
        db.close()


def check_enrichment_status(verbose: bool = False) -> Dict[str, Any]:
    """
    Check which documents have enrichment data and should be marked as 'enriched'.
    
    Returns:
        Dictionary with enrichment statistics
    """
    db = SessionLocal()
    
    results = {
        "documents_with_chunk_enrichments": [],
        "documents_with_doc_enrichments": [],
        "should_be_enriched": []
    }
    
    try:
        from backend.database.models_v2 import DocumentEnrichment
        
        documents = db.query(Document).all()
        
        for doc in documents:
            # Check chunk enrichments
            chunk_with_enrichment = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == doc.id,
                DocumentChunk.enrichment_data != None,
                DocumentChunk.enrichment_data != {}
            ).first()
            
            if chunk_with_enrichment:
                results["documents_with_chunk_enrichments"].append({
                    "id": doc.id,
                    "name": doc.name,
                    "status": doc.status
                })
            
            # Check document enrichments
            doc_enrichment = db.query(DocumentEnrichment).filter(
                DocumentEnrichment.document_id == doc.id
            ).first()
            
            if doc_enrichment:
                results["documents_with_doc_enrichments"].append({
                    "id": doc.id,
                    "name": doc.name,
                    "status": doc.status
                })
            
            # Check if should be marked as enriched
            if (chunk_with_enrichment or doc_enrichment) and doc.status == "processed":
                results["should_be_enriched"].append({
                    "id": doc.id,
                    "name": doc.name,
                    "has_chunk_enrichments": chunk_with_enrichment is not None,
                    "has_doc_enrichments": doc_enrichment is not None
                })
        
        if verbose:
            logger.info("")
            logger.info("📊 Enrichment Status Check:")
            logger.info(f"   Documents with chunk enrichments: {len(results['documents_with_chunk_enrichments'])}")
            logger.info(f"   Documents with doc enrichments: {len(results['documents_with_doc_enrichments'])}")
            logger.info(f"   Should be marked 'enriched': {len(results['should_be_enriched'])}")
            
            if results["should_be_enriched"]:
                logger.info("")
                logger.info("   Documents that should be 'enriched':")
                for doc in results["should_be_enriched"]:
                    logger.info(f"      - {doc['name']} (ID: {doc['id']})")
        
        return results
        
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate document statuses to new 3-stage pipeline system"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report what would be changed, don't apply changes"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed information"
    )
    parser.add_argument(
        "--check-enrichments",
        action="store_true",
        help="Check enrichment status of documents"
    )
    
    args = parser.parse_args()
    
    if args.check_enrichments:
        check_enrichment_status(verbose=True)
        return
    
    # Default to dry-run if not explicitly disabled
    dry_run = args.dry_run
    
    if not dry_run:
        logger.warning("")
        logger.warning("⚠️  WARNING: This will modify the database!")
        logger.warning("   Run with --dry-run first to see what would change.")
        logger.warning("")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != "yes":
            logger.info("Migration cancelled.")
            return
    
    results = migrate_document_statuses(dry_run=dry_run, verbose=args.verbose)
    
    if not results["success"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
