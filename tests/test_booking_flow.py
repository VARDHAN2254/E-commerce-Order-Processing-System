import unittest

from backend.agents.pipeline_agents import InventoryAgent, OrderAgent
from backend.models.state import OrderData


class BookingFlowTests(unittest.TestCase):
    def test_order_agent_accepts_booked_item_payload(self):
        agent = OrderAgent()
        booked_item = {
            "sku": "NVK-LAP-0001",
            "name": "AstraBook Pro 100",
            "category": "Laptops",
            "price": 1499.0,
            "discounted_price": 1299.0,
            "discount_percent": 13,
            "rating": 4.8,
            "reviews": 824,
            "features": ["16GB RAM", "512GB SSD"],
        }

        order = agent.process(order_id="BOOK-NVK-LAP-0001", seed=42, booked_item=booked_item)

        self.assertEqual(order.item_name, "AstraBook Pro 100")
        self.assertEqual(order.selected_sku, "NVK-LAP-0001")
        self.assertEqual(order.requested_sku, "NVK-LAP-0001")
        self.assertEqual(order.total_amount, 1299.0)
        self.assertEqual(order.booked_item_meta.get("discount_percent"), 13)

    def test_inventory_agent_prefers_requested_sku(self):
        agent = InventoryAgent()
        order = OrderData(
            order_id="BOOK-NVK-LAP-0001",
            customer_name="Catalog Buyer",
            item_name="Totally Different Name",
            quantity=1,
            total_amount=0.0,
            requested_sku="NVK-LAP-0001",
            selected_sku="NVK-LAP-0001",
        )

        processed = agent.process(order, seed=42)

        self.assertEqual(processed.selected_sku, "NVK-LAP-0001")
        self.assertGreater(processed.total_amount, 0.0)
        self.assertGreater(len(processed.inventory_catalog), 0)


if __name__ == "__main__":
    unittest.main()
