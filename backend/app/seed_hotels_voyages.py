"""
SOKORA — Seed Hotels & Voyages
Crée 2 hôtels avec des chambres disponibles et 2 compagnies de voyage avec des trajets ouverts.
Usage: docker-compose exec backend python -m app.seed_hotels_voyages
"""
import sys
from datetime import datetime, timedelta, timezone
from . import models, models_hotel, models_voyage
from .database import SessionLocal
from .security import get_password_hash

def run():
    db = SessionLocal()
    try:
        print("=== Seed Hotels & Voyages ===")

        # ─────────────────────────────────────────────────────────────
        # 1. ÉTABLISSEMENTS HÔTELIERS (dans la table establishments)
        # ─────────────────────────────────────────────────────────────

        # Hôtel 1 — Ivoire Business
        est_h1 = db.query(models.Establishment).filter(
            models.Establishment.name == "Ivoire Business Hotel"
        ).first()
        if not est_h1:
            est_h1 = models.Establishment(
                name="Ivoire Business Hotel",
                address="Plateau, Avenue Lamblin, Abidjan",
                phone="0700100001",
                is_active=True,
                latitude=5.3196,
                longitude=-4.0195,
            )
            db.add(est_h1)
            db.flush()
            print(f"  Created establishment: {est_h1.name} (id={est_h1.id})")
        else:
            print(f"  Establishment exists: {est_h1.name} (id={est_h1.id})")

        # Hôtel 2 — Villa Cocotiers
        est_h2 = db.query(models.Establishment).filter(
            models.Establishment.name == "Villa Les Cocotiers"
        ).first()
        if not est_h2:
            est_h2 = models.Establishment(
                name="Villa Les Cocotiers",
                address="Cocody, Abidjan",
                phone="0700100002",
                is_active=True,
                latitude=5.3579,
                longitude=-3.9935,
            )
            db.add(est_h2)
            db.flush()
            print(f"  Created establishment: {est_h2.name} (id={est_h2.id})")
        else:
            print(f"  Establishment exists: {est_h2.name} (id={est_h2.id})")

        # ─────────────────────────────────────────────────────────────
        # 2. HÔTELS
        # ─────────────────────────────────────────────────────────────

        h1 = db.query(models_hotel.Hotel).filter(
            models_hotel.Hotel.establishment_id == est_h1.id
        ).first()
        if not h1:
            h1 = models_hotel.Hotel(
                establishment_id=est_h1.id,
                name="Ivoire Business Hotel",
                description="Hôtel d'affaires au cœur du Plateau. WiFi haut débit, salle de réunion, restaurant panoramique.",
                address="Plateau, Avenue Lamblin, Abidjan",
                city="Abidjan",
                country="CI",
                latitude=5.3196,
                longitude=-4.0195,
                checkin_time="14:00",
                checkout_time="11:00",
                cancellation_hours=24,
                no_show_penalty_pct=50.0,
                deposit_pct=100.0,
                sokora_commission_pct=5.0,
                amenities=["wifi", "parking", "restaurant", "salle_reunion", "climatisation", "coffre_fort"],
                is_active=True,
                is_verified=True,
            )
            db.add(h1)
            db.flush()
            print(f"  Created hotel: {h1.name} (id={h1.id})")

            # Types de chambres
            rt_standard = models_hotel.RoomType(
                hotel_id=h1.id, name="Standard", description="Chambre simple, lit double, vue ville",
                bed_type=models_hotel.RoomBedType.DOUBLE, capacity=2, base_price=35000.0,
                amenities=["wifi", "tv", "clim", "sdb_privee"],
            )
            rt_deluxe = models_hotel.RoomType(
                hotel_id=h1.id, name="Deluxe", description="Chambre spacieuse, lit king, vue lagon",
                bed_type=models_hotel.RoomBedType.KING, capacity=2, base_price=55000.0,
                amenities=["wifi", "tv", "clim", "sdb_privee", "minibar", "vue_mer"],
            )
            rt_suite = models_hotel.RoomType(
                hotel_id=h1.id, name="Suite Exécutive", description="Suite avec salon, jacuzzi et terrasse",
                bed_type=models_hotel.RoomBedType.SUITE, capacity=3, base_price=95000.0,
                amenities=["wifi", "tv", "clim", "jacuzzi", "terrasse", "minibar", "room_service"],
            )
            db.add_all([rt_standard, rt_deluxe, rt_suite])
            db.flush()

            # Chambres
            rooms_data = [
                (rt_standard.id, "101", 1, "AVAILABLE"),
                (rt_standard.id, "102", 1, "AVAILABLE"),
                (rt_standard.id, "103", 1, "OCCUPIED"),
                (rt_deluxe.id,   "201", 2, "AVAILABLE"),
                (rt_deluxe.id,   "202", 2, "AVAILABLE"),
                (rt_deluxe.id,   "203", 2, "CLEANING"),
                (rt_suite.id,    "301", 3, "AVAILABLE"),
                (rt_suite.id,    "302", 3, "RESERVED"),
            ]
            for rt_id, num, floor, status in rooms_data:
                db.add(models_hotel.Room(
                    hotel_id=h1.id, room_type_id=rt_id,
                    number=num, floor=floor,
                    status=models_hotel.RoomStatus(status),
                    is_active=True,
                ))
            print(f"    Created {len(rooms_data)} rooms for {h1.name}")
        else:
            print(f"  Hotel exists: {h1.name}")

        h2 = db.query(models_hotel.Hotel).filter(
            models_hotel.Hotel.establishment_id == est_h2.id
        ).first()
        if not h2:
            h2 = models_hotel.Hotel(
                establishment_id=est_h2.id,
                name="Villa Les Cocotiers",
                description="Villa paisible à Cocody. Piscine, jardin tropical, ambiance familiale.",
                address="Cocody, Abidjan",
                city="Abidjan",
                country="CI",
                latitude=5.3579,
                longitude=-3.9935,
                checkin_time="15:00",
                checkout_time="12:00",
                cancellation_hours=48,
                no_show_penalty_pct=30.0,
                deposit_pct=50.0,
                sokora_commission_pct=5.0,
                amenities=["wifi", "piscine", "jardin", "parking", "petit_dejeuner"],
                is_active=True,
                is_verified=True,
            )
            db.add(h2)
            db.flush()
            print(f"  Created hotel: {h2.name} (id={h2.id})")

            # Types de chambres
            rt_villa = models_hotel.RoomType(
                hotel_id=h2.id, name="Villa Standard", description="Bungalow avec accès piscine",
                bed_type=models_hotel.RoomBedType.DOUBLE, capacity=2, base_price=45000.0,
                amenities=["wifi", "tv", "clim", "jardin_prive", "acces_piscine"],
            )
            rt_family = models_hotel.RoomType(
                hotel_id=h2.id, name="Villa Familiale", description="Grand bungalow 2 chambres",
                bed_type=models_hotel.RoomBedType.TWIN, capacity=4, base_price=75000.0,
                amenities=["wifi", "tv", "clim", "2_chambres", "cuisine", "acces_piscine"],
            )
            db.add_all([rt_villa, rt_family])
            db.flush()

            rooms_data2 = [
                (rt_villa.id,  "V1", 1, "AVAILABLE"),
                (rt_villa.id,  "V2", 1, "AVAILABLE"),
                (rt_villa.id,  "V3", 1, "OCCUPIED"),
                (rt_family.id, "F1", 1, "AVAILABLE"),
                (rt_family.id, "F2", 1, "AVAILABLE"),
            ]
            for rt_id, num, floor, status in rooms_data2:
                db.add(models_hotel.Room(
                    hotel_id=h2.id, room_type_id=rt_id,
                    number=num, floor=floor,
                    status=models_hotel.RoomStatus(status),
                    is_active=True,
                ))
            print(f"    Created {len(rooms_data2)} rooms for {h2.name}")
        else:
            print(f"  Hotel exists: {h2.name}")

        # ─────────────────────────────────────────────────────────────
        # 3. COMPAGNIES DE VOYAGE
        # ─────────────────────────────────────────────────────────────

        c1 = db.query(models_voyage.VoyageCompany).filter(
            models_voyage.VoyageCompany.name == "Trans Abidjan Express"
        ).first()
        if not c1:
            c1 = models_voyage.VoyageCompany(
                name="Trans Abidjan Express",
                phone="0700200001",
                address="Gare de Yopougon, Abidjan",
                is_active=True,
            )
            db.add(c1)
            db.flush()
            print(f"  Created company: {c1.name} (id={c1.id})")

            # Véhicule
            bus1 = models_voyage.VoyageVehicle(
                company_id=c1.id, name="Bus Express 01",
                plate="AB-2024-CI", vehicle_type=models_voyage.VehicleType.BUS,
                seat_count=32, is_active=True,
            )
            bus2 = models_voyage.VoyageVehicle(
                company_id=c1.id, name="Minibus 02",
                plate="AB-2025-CI", vehicle_type=models_voyage.VehicleType.MINIBUS,
                seat_count=15, is_active=True,
            )
            db.add_all([bus1, bus2])
            db.flush()

            # Routes
            r_abj_aboisso = models_voyage.VoyageRoute(
                company_id=c1.id, origin="Abidjan", destination="Aboisso",
                distance_km=120.0, duration_min=150, base_price=3000.0, is_active=True,
            )
            r_abj_yamou = models_voyage.VoyageRoute(
                company_id=c1.id, origin="Abidjan", destination="Yamoussoukro",
                distance_km=250.0, duration_min=240, base_price=6000.0, is_active=True,
            )
            r_abj_bouake = models_voyage.VoyageRoute(
                company_id=c1.id, origin="Abidjan", destination="Bouaké",
                distance_km=360.0, duration_min=330, base_price=8000.0, is_active=True,
            )
            db.add_all([r_abj_aboisso, r_abj_yamou, r_abj_bouake])
            db.flush()

            # Chauffeur
            driver1 = models_voyage.VoyageDriver(
                company_id=c1.id, full_name="Kouassi Jean", phone="0700200010",
                license_no="CI-DRV-001", is_active=True,
                password_hash=get_password_hash("driver123"),
                driver_token="drv_tok_" + "kouassi001",
            )
            db.add(driver1)
            db.flush()

            # Trajets ouverts (demain et après-demain)
            tomorrow  = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=7, minute=0, second=0)
            d2        = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=7, minute=0, second=0)
            d3        = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=14, minute=0, second=0)
            trips_c1 = [
                (r_abj_aboisso.id, bus1.id, driver1.id, tomorrow, 3000.0, 32),
                (r_abj_yamou.id,   bus1.id, driver1.id, d2,       6000.0, 32),
                (r_abj_bouake.id,  bus2.id, driver1.id, d3,       8000.0, 15),
            ]
            for r_id, v_id, d_id, dep, price, seats in trips_c1:
                trip = models_voyage.VoyageTrip(
                    route_id=r_id, vehicle_id=v_id, driver_id=d_id,
                    departure_at=dep, price=price, seats_total=seats,
                    seats_booked=0, status=models_voyage.TripStatus.SCHEDULED,
                )
                db.add(trip)
                db.flush()
                # Créer les sièges
                for sn in range(1, seats + 1):
                    db.add(models_voyage.VoyageTripSeat(
                        trip_id=trip.id, seat_number=sn,
                        status=models_voyage.SeatStatus.FREE,
                    ))
            print(f"    Created 3 trips for {c1.name}")
        else:
            print(f"  Company exists: {c1.name}")

        c2 = db.query(models_voyage.VoyageCompany).filter(
            models_voyage.VoyageCompany.name == "Côte Sud Voyages"
        ).first()
        if not c2:
            c2 = models_voyage.VoyageCompany(
                name="Côte Sud Voyages",
                phone="0700200002",
                address="Gare de Treichville, Abidjan",
                is_active=True,
            )
            db.add(c2)
            db.flush()
            print(f"  Created company: {c2.name} (id={c2.id})")

            van1 = models_voyage.VoyageVehicle(
                company_id=c2.id, name="Van Premium 01",
                plate="AB-3001-CI", vehicle_type=models_voyage.VehicleType.VAN,
                seat_count=8, is_active=True,
            )
            db.add(van1)
            db.flush()

            r_abj_san = models_voyage.VoyageRoute(
                company_id=c2.id, origin="Abidjan", destination="San-Pédro",
                distance_km=340.0, duration_min=300, base_price=7500.0, is_active=True,
            )
            r_abj_gd = models_voyage.VoyageRoute(
                company_id=c2.id, origin="Abidjan", destination="Grand-Bassam",
                distance_km=40.0, duration_min=50, base_price=1500.0, is_active=True,
            )
            db.add_all([r_abj_san, r_abj_gd])
            db.flush()

            driver2 = models_voyage.VoyageDriver(
                company_id=c2.id, full_name="Yao Koffi", phone="0700200020",
                license_no="CI-DRV-002", is_active=True,
                password_hash=get_password_hash("driver123"),
                driver_token="drv_tok_" + "yao002",
            )
            db.add(driver2)
            db.flush()

            d1 = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=6, minute=30, second=0)
            d2t = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=8, minute=0, second=0)
            trips_c2 = [
                (r_abj_san.id, van1.id, driver2.id, d1,  7500.0, 8),
                (r_abj_gd.id,  van1.id, driver2.id, d2t, 1500.0, 8),
            ]
            for r_id, v_id, d_id, dep, price, seats in trips_c2:
                trip = models_voyage.VoyageTrip(
                    route_id=r_id, vehicle_id=v_id, driver_id=d_id,
                    departure_at=dep, price=price, seats_total=seats,
                    seats_booked=0, status=models_voyage.TripStatus.SCHEDULED,
                )
                db.add(trip)
                db.flush()
                for sn in range(1, seats + 1):
                    db.add(models_voyage.VoyageTripSeat(
                        trip_id=trip.id, seat_number=sn,
                        status=models_voyage.SeatStatus.FREE,
                    ))
            print(f"    Created 2 trips for {c2.name}")
        else:
            print(f"  Company exists: {c2.name}")

        db.commit()
        print("\n=== Seed hotels & voyages terminé ===")
        print("\nComptes drivers:")
        print("  Kouassi Jean — Phone: 0700200010 — Password: driver123")
        print("  Yao Koffi    — Phone: 0700200020 — Password: driver123")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
