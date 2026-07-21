from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.models import Rule
from app.schemas.rule import RuleCreate, RuleRead, RuleUpdate

router = APIRouter(prefix="/rules", tags=["rules"])


def _get_owned_rule(db: Session, rule_id: int) -> Rule:
    """自分が所有するルールを取得する。

    rules_owner_all（user_id直接参照のRLS）が既に他ユーザーの行を
    不可視にしているため、ここでの存在チェックは同時にオーナーチェックにもなる。
    """
    rule = db.get(Rule, rule_id)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ルールが見つかりません"
        )
    return rule


@router.post("", response_model=RuleRead, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: RuleCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Rule:
    rule = Rule(user_id=user_id, **payload.model_dump())
    db.add(rule)
    db.flush()
    return rule


@router.get("", response_model=list[RuleRead])
def list_rules(db: Session = Depends(get_db)) -> list[Rule]:
    return db.query(Rule).order_by(Rule.created_at.desc(), Rule.id.desc()).all()


@router.get("/{rule_id}", response_model=RuleRead)
def get_rule(rule_id: int, db: Session = Depends(get_db)) -> Rule:
    return _get_owned_rule(db, rule_id)


@router.patch("/{rule_id}", response_model=RuleRead)
def update_rule(
    rule_id: int, payload: RuleUpdate, db: Session = Depends(get_db)
) -> Rule:
    """部分更新。is_activeだけを送れば有効/無効の素早い切り替えにも使える。"""
    rule = _get_owned_rule(db, rule_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.flush()
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, db: Session = Depends(get_db)) -> None:
    rule = _get_owned_rule(db, rule_id)
    db.delete(rule)
    db.flush()
