#!/usr/bin/env python3
"""
Migration script: Add language column to writer_articles and seed English version of the blog post
"""
import sys
import os
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from database.connection_v2 import Base
from database.models_platform import WriterArticle, Organization
from sqlalchemy import text, inspect
from sqlalchemy.orm import sessionmaker

def run_migration():
    # 1. Add language column to writer_articles if not exists
    inspector = inspect(engine)
    print("Checking 'writer_articles' table columns...")
    columns = inspector.get_columns('writer_articles')
    column_names = [c['name'] for c in columns]
    
    if 'language' not in column_names:
        print("Adding column 'language' to 'writer_articles' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE writer_articles ADD COLUMN language VARCHAR(10) DEFAULT 'tr' NOT NULL"))
            conn.commit()
        print("✅ Column 'language' added successfully!")
    else:
        print("ℹ️ Column 'language' already exists in 'writer_articles' table.")

    # 2. Seed English article
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        # Find organization
        org = db.query(Organization).filter(Organization.slug == "ragleaf-platform").first()
        if not org:
            print("❌ Organization 'ragleaf-platform' not found!")
            return

        # Check if english article already exists
        en_slug = "retrieval-augmented-generation-rag-technologies-and-enterprise-knowledge-management"
        exists = db.query(WriterArticle).filter(
            WriterArticle.organization_id == org.id,
            WriterArticle.slug == en_slug
        ).first()

        if not exists:
            print("Seeding English translation of the blog post...")
            
            content_en = (
                "## Introduction\n\n"
                "Retrieval-Augmented Generation (RAG) has emerged as a revolutionary approach in the field of artificial intelligence in recent years. "
                "While traditional Large Language Models (LLMs) generate text based on pre-trained static datasets, RAG enhances this generation process "
                "by adding real-time information retrieval capabilities, offering a significant advantage in accuracy and truthfulness. "
                "In enterprise AI strategies, RAG is widely used in critical areas such as fast information access, decision support systems, "
                "and customer service. In this article, we will examine the core principles of RAG technology, vector database integration, "
                "how it is combined with LLMs, and the transformation it can bring to enterprise knowledge management.\n\n"
                "## Key Components of RAG\n\n"
                "The core components of RAG consist of three main parts: (1) Retrieval – selecting relevant pieces from the information pool, "
                "(2) Augmentation – adding these pieces to the model's context, and (3) Generation – producing the final text. "
                "Vector databases (e.g., FAISS, Milvus, or Pinecone) are typically used in the retrieval stage. A vector database converts documents "
                "into high-dimensional vectors, enabling similarity searches to be performed extremely quickly. In an enterprise environment, "
                "these databases usually contain the company's entire document collection (emails, reports, technical documentation).\n\n"
                "Vector database integration directly affects the performance of RAG. Choosing the right indexing strategy increases query speed "
                "and result quality. For example, the HNSW (Hierarchical Navigable Small World) algorithm can perform approximate nearest neighbor searches "
                "in a fraction of a millisecond, even on large datasets. During enterprise data migration, preprocessing steps (OCR, tokenization, embedding) "
                "must be applied to automatically vectorize document formats (PDF, DOCX, HTML).\n\n"
                "RAG's LLM integration expands the model's context. While traditional LLMs cannot learn new information outside of the dataset they were "
                "trained on, RAG enables the model to fetch external information in real-time. This is a critical feature, especially for Enterprise AI projects; "
                "because it can rapidly integrate dynamic information such as internal policy changes, product updates, or legal regulations. "
                "For instance, while a sales representative is chatting with a customer, a RAG-enabled chatbot can instantly fetch the latest pricing "
                "documents and provide the correct price recommendation.\n\n"
                "During the LLM Integration process, the query output of the model is fed directly into the text generation process. This creates "
                "a two-stage pipeline: first, relevant vectors are retrieved from the database; then, these vectors are added to the model's token sequence "
                "to expand the context. Modern LLMs (e.g., GPT-4, LLaMA, Claude) can naturally process such additional context, but the model's token limit "
                "must be considered. In most cases, retrieved documents must be summarized or added in a ranked order; otherwise, exceeding the token limit "
                "can degrade model performance.\n\n"
                "In the context of enterprise knowledge management, RAG democratizes access to information. Users can ask questions in natural language "
                "instead of complex search queries, and the system automatically retrieves relevant information. This removes barriers to information access "
                "and increases employee productivity. Additionally, thanks to RAG, companies can detect information errors early; because the model relies "
                "on an information pool that is continuously updated with current documents.\n\n"
                "## Enterprise Applications of RAG\n\n"
                "To deeply analyze RAG's enterprise applications, several scenarios can be considered. First, in the legal consulting field, lawyers work "
                "with vast amounts of contracts and legal documents. RAG enriches the documents prepared by the lawyer by quickly fetching relevant laws, "
                "past case outcomes, and internal company procedures. This saves significant time and cost.\n\n"
                "A second scenario is customer support services. While support agents respond to frequently asked questions, a RAG-backed system fetches "
                "the latest updates from product manuals. Thus, agents always present the most accurate and up-to-date information to the customer, increasing "
                "customer satisfaction. The third scenario is in research and development (R&D). While scientists conduct literature reviews, RAG allows them "
                "to instantly find the most relevant articles, experimental data, and patent information.\n\n"
                "RAG's security and privacy challenges should not be overlooked. Most enterprise data may be confidential or have restricted access. "
                "Therefore, data privacy protocols must be applied during vector database and LLM integration. For example, vectors can be anonymized "
                "using differential privacy techniques, or database security can be ensured with encryption at rest. Additionally, filtering mechanisms "
                "should be added to inspect model output to prevent accidental sharing of sensitive information.\n\n"
                "Performance metrics also determine the success of RAG systems. Recall and Precision metrics show how effectively the system retrieves "
                "the correct information. Additionally, latency measurements are a critical factor in real-time applications. In an enterprise environment, "
                "the scalability of RAG systems must be resilient to high data volumes and intensive query demands. Therefore, response times are optimized "
                "using distributed computing solutions (e.g., Kubernetes, Spark) and edge computing strategies.\n\n"
                "Finally, when examining the future of RAG and its development trends, the concept of multimodal RAG stands out. Systems that integrate "
                "different data types such as text, image, audio, and video at the same time will further enrich enterprise knowledge management. "
                "For example, during a video conference, the system automatically retrieves related documents and displays them on the screen, improving meeting efficiency.\n\n"
                "## Conclusion\n\n"
                "Retrieval-Augmented Generation (RAG) technologies are driving a revolutionary transformation in enterprise knowledge management. "
                "Integrated with vector databases, RAG increases the accuracy and freshness of LLMs thanks to its real-time information retrieval capability. "
                "In enterprise AI solutions, RAG can be applied across a wide range of areas from decision support systems to customer service, legal consulting to R&D. "
                "With careful design regarding security, privacy, and performance, RAG becomes a powerful tool that strengthens companies' competitive advantage. "
                "In the future, the boundaries of enterprise knowledge management will expand even further with multimodal RAG and more advanced data privacy techniques."
            )

            article = WriterArticle(
                organization_id=org.id,
                title="Retrieval-Augmented Generation (RAG) Technologies and Enterprise Knowledge Management",
                slug=en_slug,
                summary="Explore how Retrieval-Augmented Generation (RAG) is transforming enterprise knowledge management, vector DB integrations, and LLM orchestration.",
                content=content_en,
                keywords=["RAG", "Retrieval-Augmented Generation", "Enterprise AI", "Vector Database", "LLM Integration"],
                outline=["Introduction", "Key Components of RAG", "Enterprise Applications of RAG", "Conclusion"],
                status="published",
                mode="autonomous",
                publishing_platform="nextjs",
                language="en",
                published_at=datetime.now(timezone.utc),
                extra_data={
                    "model": "manual-seed",
                    "note": "English translation for multilingual blog support"
                }
            )
            db.add(article)
            db.commit()
            print("✅ English article seeded successfully!")
        else:
            print("ℹ️ English article already exists.")
            
    except Exception as e:
        print(f"❌ Migration/Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
