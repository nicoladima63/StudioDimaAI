import logging
import sys

def setup_logging(level=logging.INFO):
    logger = logging.getLogger()  # root logger
    if logger.hasHandlers():
        logger.handlers.clear()

    formatter = logging.Formatter(
        fmt='[%(asctime)s] [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    logger.setLevel(level)



#Come usarli insieme

#Nel tuo main script o entrypoint:
#from app.config.logging_config import setup_logging
#setup_logging(level=logging.DEBUG)  # o INFO per produzione

#In ogni modulo, ad esempio sync_utils.py, puoi fare:
#import logging
#logger = logging.getLogger(__name__)
#logger.info("Messaggio di log")
