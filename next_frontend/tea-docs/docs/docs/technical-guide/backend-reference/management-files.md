---
sidebar_position: 2
sidebar_label: 'Backend Management Files'
---

# Backend Management Files

The TEA Platform, developed using Django and the Django REST framework, comprises several Python modules that are pivotal to its operation.
These modules play specific roles in defining the platform's database schema, data serialization, request handling, and URL routing.
Here’s an overview of these essential components:

- **Models ([`eap_api/models.py`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/eap_backend/eap_api/models.py))**: This file is at the heart of defining the platform's database schema using Django's Object-Relational Mapping (ORM) system. Each class that inherits from django.db.models.Model is mapped to a database table, setting the groundwork for how data is stored, retrieved, and manipulated within the platform.
- **Serializers ([`eap_api/serializers.py`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/eap_backend/eap_api/serializers.py))**: The serializers handle the conversion between Model instances and JSON, making it possible for the platform’s data to be easily transferred over the web. This file ensures that complex model instances can be transformed into a format that can be understood by the frontend and vice versa.
- **Views ([`eap_api/views.py`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/eap_backend/eap_api/views.py))**: The views module defines the logic for each API endpoint, dictating how requests are processed and how data is returned to the client. Special attention is given to requests that require nested JSON structures, employing a recursive function get_json_tree to assemble the comprehensive data structure for assurance cases and their related components.
- **URLs ([`eap_api/urls.py`](https://github.com/alan-turing-institute/AssurancePlatform/blob/main/eap_backend/eap_api/urls.py))**: This module maps the available API endpoints to their corresponding view functions in views.py, establishing the routes that clients interact with. It acts as the web-facing interface of the backend, directing incoming requests to the appropriate handlers based on the requested URL path.

Understanding these modules and their functions within the Django framework provides a solid foundation for contributing to or extending the TEA Platform. Each plays a crucial role in ensuring the platform's backend operates efficiently, securely, and in harmony with the frontend application.
