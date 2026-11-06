from datetime import datetime, timedelta

from services.economics.monthly_aggregator import _is_expired


def _ago(**kw):
    return (datetime.now() - timedelta(**kw)).isoformat()


def test_anno_corrente_scade_dopo_un_ora():
    anno = datetime.now().year
    assert not _is_expired(anno, _ago(minutes=10))
    assert _is_expired(anno, _ago(hours=2))


def test_anno_chiuso_non_scade():
    assert not _is_expired(datetime.now().year - 1, _ago(days=300))


def test_data_illeggibile_conta_come_scaduta():
    assert _is_expired(datetime.now().year, '')
