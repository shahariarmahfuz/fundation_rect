from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.database import SessionLocal
from backend.app.models import Permission, Role, User, Group, role_permissions

PERMISSIONS = [
    # Group permissions
    ("groups.view", "View groups and group management page", "groups"),
    ("groups.create", "Create new foundation groups", "groups"),
    ("groups.update", "Edit group details", "groups"),
    ("groups.deactivate", "Deactivate or activate groups", "groups"),
    ("group_funds.view", "View group fund balances and financial summaries", "groups"),
    ("group_funds.ledger.view", "View group fund transaction ledger", "groups"),
    # Member permissions
    ("members.view", "View members and member management list", "members"),
    ("members.create", "Register new members", "members"),
    ("members.update", "Edit existing member details", "members"),
    ("members.activate", "Activate inactive members", "members"),
    ("members.deactivate", "Deactivate active members", "members"),
    ("members.due_list.view", "View member due list page", "members"),
    # Beneficiary permissions
    ("beneficiaries.view", "View beneficiaries and directory", "beneficiaries"),
    ("beneficiaries.create", "Register new beneficiaries", "beneficiaries"),
    ("beneficiaries.update", "Edit beneficiary details", "beneficiaries"),
    ("beneficiaries.activate", "Activate beneficiaries", "beneficiaries"),
    ("beneficiaries.deactivate", "Deactivate beneficiaries", "beneficiaries"),
    ("beneficiary_ledger.view", "View beneficiary financial ledger", "beneficiaries"),
    # Donation permissions
    ("donations.view", "View donations and donation management", "donations"),
    ("donations.create", "Record new donations", "donations"),
    ("donations.update", "Edit donation details", "donations"),
    ("donations.cancel", "Cancel or reverse donation records", "donations"),
    ("donation_reports.view", "View donation reports and summaries", "donations"),
    # Role permissions
    ("roles.manage", "Assign and manage RBAC roles and permissions", "roles"),
]

def seed_database():
    db: Session = SessionLocal()
    try:
        # Seed permissions
        perm_map = {}
        for code, desc, mod in PERMISSIONS:
            perm = db.query(Permission).filter_by(code=code).first()
            if not perm:
                perm = Permission(code=code, description=desc, module=mod)
                db.add(perm)
                db.flush()
            perm_map[code] = perm

        # Seed roles
        admin_role = db.query(Role).filter_by(name="Administrator").first()
        if not admin_role:
            admin_role = Role(name="Administrator", description="Full administrative access to all modules")
            db.add(admin_role)
            db.flush()
        # Admin gets all permissions
        admin_role.permissions = list(perm_map.values())

        officer_role = db.query(Role).filter_by(name="Field Officer").first()
        if not officer_role:
            officer_role = Role(name="Field Officer", description="Can register and manage groups, members, and beneficiaries")
            db.add(officer_role)
            db.flush()
        officer_perms = [
            perm_map["groups.view"],
            perm_map["groups.create"],
            perm_map["groups.update"],
            perm_map["members.view"],
            perm_map["members.create"],
            perm_map["members.update"],
            perm_map["beneficiaries.view"],
            perm_map["beneficiaries.create"],
            perm_map["beneficiaries.update"],
        ]
        officer_role.permissions = officer_perms

        finance_role = db.query(Role).filter_by(name="Finance Officer").first()
        if not finance_role:
            finance_role = Role(name="Finance Officer", description="Access to fund balances, ledgers, and due lists")
            db.add(finance_role)
            db.flush()
        finance_perms = [
            perm_map["groups.view"],
            perm_map["group_funds.view"],
            perm_map["group_funds.ledger.view"],
            perm_map["members.view"],
            perm_map["members.due_list.view"],
            perm_map["beneficiaries.view"],
            perm_map["beneficiary_ledger.view"],
        ]
        finance_role.permissions = finance_perms

        viewer_role = db.query(Role).filter_by(name="Viewer").first()
        if not viewer_role:
            viewer_role = Role(name="Viewer", description="Read-only access to basic lists")
            db.add(viewer_role)
            db.flush()
        viewer_perms = [
            perm_map["groups.view"],
            perm_map["members.view"],
            perm_map["beneficiaries.view"],
        ]
        viewer_role.permissions = viewer_perms

        # Seed users
        users_data = [
            ("admin", "admin@foundation.org", "System Administrator", admin_role.id),
            ("officer", "officer@foundation.org", "Jane Officer", officer_role.id),
            ("finance", "finance@foundation.org", "Bob Finance", finance_role.id),
            ("viewer", "viewer@foundation.org", "Alice Viewer", viewer_role.id),
        ]
        for uname, email, fname, rid in users_data:
            user = db.query(User).filter_by(username=uname).first()
            if not user:
                user = User(username=uname, email=email, full_name=fname, role_id=rid, is_active=True)
                db.add(user)

        # Seed initial groups if none exist
        if db.query(Group).count() == 0:
            groups_data = [
                ("G-0001", "Dhaka Central Welfare", "Community development and mutual aid group in central Dhaka.", "Active"),
                ("G-0002", "Chittagong Coastal Initiative", "Supporting coastal families with sustainable social programs.", "Active"),
                ("G-0003", "Sylhet Community Circle", "Education and vocational support in the Sylhet region.", "Active"),
            ]
            for gcode, gname, gdesc, gstatus in groups_data:
                grp = Group(code=gcode, name=gname, description=gdesc, status=gstatus)
                db.add(grp)
            db.commit()
            # Fast-forward sequence to 4 so next generated code is G-0004
            db.execute(text("SELECT setval('group_code_seq', 3, true)"))
            db.commit()
        else:
            db.commit()

        print("Database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
