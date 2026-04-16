.PHONY: dev install-only desktop-install desktop-start desktop-stop

dev:
	bash ./scripts/dev.sh

install-only:
	bash ./scripts/dev.sh --install-only

desktop-install:
	bash ./scripts/install-desktop-entry.sh

desktop-start:
	bash ./scripts/desktop-start.sh

desktop-stop:
	bash ./scripts/desktop-stop.sh
