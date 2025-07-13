"""
Factory definitions for collaboration-related models.

This module provides FactoryBoy factories for:
- Comment model
"""

import factory
from django.contrib.contenttypes.models import ContentType

from api.models import Comment
from tests.factories.content_factories import TopLevelNormativeGoalFactory
from tests.factories.user_factories import EAPUserFactory


class CommentFactory(factory.django.DjangoModelFactory):
    """Factory for Comment model."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    created_at = factory.Faker("date_time_this_year")

    # Generic foreign key fields
    content_type = factory.LazyAttribute(
        lambda obj: ContentType.objects.get_for_model(obj.content_object)
    )
    object_id = factory.SelfAttribute("content_object.id")

    # Default content object (can be overridden)
    content_object = factory.SubFactory(TopLevelNormativeGoalFactory)

    # Optional parent for nested comments
    parent = None

    @factory.post_generation
    def set_content_type(self, create, extracted, **kwargs):
        """Set content_type based on content_object."""
        if create and self.content_object:
            self.content_type = ContentType.objects.get_for_model(self.content_object)
            self.object_id = self.content_object.id
            self.save()


class ReplyCommentFactory(CommentFactory):
    """Factory for reply comments (with parent)."""

    parent = factory.SubFactory(CommentFactory)
    content = factory.Faker("sentence", nb_words=10)
